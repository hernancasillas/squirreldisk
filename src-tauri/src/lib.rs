mod disks;
mod insights;
mod scan;
mod tree;

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering::Relaxed};
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};

use scan::{Options, Progress};
use tree::{FileEntry, Node, ViewNode, ViewOptions};

struct ScanResult {
    root_path: PathBuf,
    root: Node,
    duration: Duration,
    errors: u64,
}

#[derive(Default)]
struct AppState {
    /// Progress of the scan currently running, if any.
    job: Mutex<Option<Arc<Progress>>>,
    result: RwLock<Option<ScanResult>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressEvent {
    files: u64,
    dirs: u64,
    bytes: u64,
    errors: u64,
    current: String,
    elapsed_ms: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DoneEvent {
    cancelled: bool,
    /// Rescan of a folder inside the current result instead of a new scan.
    partial: bool,
    summary: Option<Summary>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Summary {
    root: String,
    size: u64,
    files: u64,
    errors: u64,
    duration_ms: u64,
}

impl ScanResult {
    fn summary(&self) -> Summary {
        Summary {
            root: self.root_path.to_string_lossy().into_owned(),
            size: self.root.size,
            files: self.root.files,
            errors: self.errors,
            duration_ms: self.duration.as_millis() as u64,
        }
    }

    fn segments(&self, path: &str) -> Result<Vec<String>, String> {
        tree::relative_segments(&self.root_path, Path::new(path))
            .ok_or_else(|| format!("{path} is outside of the scanned folder"))
    }
}

fn progress_event(p: &Progress, started: Instant) -> ProgressEvent {
    ProgressEvent {
        files: p.files.load(Relaxed),
        dirs: p.dirs.load(Relaxed),
        bytes: p.bytes.load(Relaxed),
        errors: p.errors.load(Relaxed),
        current: p.current.lock().map(|c| c.clone()).unwrap_or_default(),
        elapsed_ms: started.elapsed().as_millis() as u64,
    }
}

#[tauri::command]
fn list_disks() -> Vec<disks::DiskInfo> {
    disks::list()
}

/// Starts scanning `path` in the background. Progress is reported through
/// `scan://progress` events and completion through `scan://done`.
///
/// When `path` lies inside the folder scanned last, only that subtree is
/// rescanned and spliced into the existing result.
#[tauri::command]
fn start_scan(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
    exclude: Vec<String>,
    refresh: bool,
) -> Result<(), String> {
    let root = PathBuf::from(&path);
    if !root.exists() {
        return Err(format!("{path} does not exist"));
    }

    let partial = refresh
        && state
            .result
            .read()
            .unwrap()
            .as_ref()
            .and_then(|r| tree::relative_segments(&r.root_path, &root))
            .is_some_and(|segments| !segments.is_empty());

    let progress = Arc::new(Progress::default());
    {
        let mut job = state.job.lock().unwrap();
        if let Some(previous) = job.take() {
            previous.cancel();
        }
        *job = Some(progress.clone());
    }
    if !partial {
        *state.result.write().unwrap() = None;
    }

    let mut skip = scan::default_skips(&root, &disks::mount_points());
    skip.extend(exclude.iter().map(PathBuf::from));
    let opts = Options { root, skip };

    std::thread::Builder::new()
        .name("scan".into())
        .spawn(move || run_scan(app, opts, progress, partial))
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn run_scan(app: AppHandle, opts: Options, progress: Arc<Progress>, partial: bool) {
    let started = Instant::now();

    let finished = Arc::new(AtomicBool::new(false));
    let ticker = {
        let app = app.clone();
        let progress = progress.clone();
        let finished = finished.clone();
        std::thread::spawn(move || {
            while !finished.load(Relaxed) && !progress.is_cancelled() {
                app.emit("scan://progress", progress_event(&progress, started))
                    .ok();
                std::thread::sleep(Duration::from_millis(150));
            }
        })
    };

    let threads = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
        .clamp(4, 16)
        * 2;
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(threads)
        .stack_size(16 * 1024 * 1024)
        .thread_name(|i| format!("scan-{i}"))
        .build();
    let tree = match pool {
        Ok(pool) => pool.install(|| scan::scan(&opts, &progress)),
        Err(_) => scan::scan(&opts, &progress),
    };

    let state = app.state::<AppState>();
    {
        let mut job = state.job.lock().unwrap();
        if job.as_ref().is_some_and(|j| Arc::ptr_eq(j, &progress)) {
            *job = None;
        }
    }
    finished.store(true, Relaxed);
    ticker.join().ok();

    let Some(mut root) = tree else {
        app.emit(
            "scan://done",
            DoneEvent {
                cancelled: true,
                partial,
                summary: None,
            },
        )
        .ok();
        return;
    };
    app.emit("scan://progress", progress_event(&progress, started))
        .ok();

    let errors = progress.errors.load(Relaxed);
    let mut result = state.result.write().unwrap();
    // A newer scan may have superseded this one while it was finishing.
    if progress.is_cancelled() {
        app.emit(
            "scan://done",
            DoneEvent {
                cancelled: true,
                partial,
                summary: None,
            },
        )
        .ok();
        return;
    }
    let summary = if partial {
        let Some(current) = result.as_mut() else {
            app.emit(
                "scan://done",
                DoneEvent {
                    cancelled: true,
                    partial,
                    summary: None,
                },
            )
            .ok();
            return;
        };
        let segments = tree::relative_segments(&current.root_path, &opts.root).unwrap_or_default();
        if let Some(name) = segments.last() {
            root.name = name.as_str().into();
        }
        current.root.replace(&segments, root);
        current.summary()
    } else {
        let scanned = ScanResult {
            root_path: opts.root,
            root,
            duration: started.elapsed(),
            errors,
        };
        let summary = scanned.summary();
        *result = Some(scanned);
        summary
    };
    app.emit(
        "scan://done",
        DoneEvent {
            cancelled: false,
            partial,
            summary: Some(summary),
        },
    )
    .ok();
}

#[tauri::command]
fn cancel_scan(state: State<'_, AppState>) {
    if let Some(job) = state.job.lock().unwrap().take() {
        job.cancel();
    }
}

#[tauri::command]
fn scan_summary(state: State<'_, AppState>) -> Option<Summary> {
    state
        .result
        .read()
        .unwrap()
        .as_ref()
        .map(ScanResult::summary)
}

#[tauri::command]
fn get_tree(
    state: State<'_, AppState>,
    path: String,
    depth: u32,
    min_ratio: f64,
    limit: usize,
) -> Result<ViewNode, String> {
    let guard = state.result.read().unwrap();
    let result = guard.as_ref().ok_or("No scan available")?;
    let segments = result.segments(&path)?;
    let node = result.root.find(&segments).ok_or("Item not found")?;
    let opts = ViewOptions {
        depth: depth.min(8),
        min_size: (node.size as f64 * min_ratio.clamp(0.0, 1.0)) as u64,
        limit: limit.max(1),
    };
    let mut view = tree::view(node, Path::new(&path), &opts);
    if segments.is_empty() {
        view.name = result.root_path.to_string_lossy().into_owned();
    }
    Ok(view)
}

#[tauri::command]
fn largest_files(
    state: State<'_, AppState>,
    path: String,
    limit: usize,
) -> Result<Vec<FileEntry>, String> {
    let guard = state.result.read().unwrap();
    let result = guard.as_ref().ok_or("No scan available")?;
    let node = result
        .root
        .find(&result.segments(&path)?)
        .ok_or("Item not found")?;
    Ok(tree::largest_files(node, Path::new(&path), limit.min(5000)))
}

/// Well-known folders in the current scan that are usually safe to clean up.
#[tauri::command]
async fn find_insights(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<insights::Insight>, String> {
    let home = app.path().home_dir().ok();
    let guard = state.result.read().unwrap();
    let result = guard.as_ref().ok_or("No scan available")?;
    Ok(insights::find(
        &result.root,
        &result.root_path,
        home.as_deref(),
    ))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DeleteOutcome {
    path: String,
    ok: bool,
    freed: u64,
    error: Option<String>,
}

/// Moves items to the Trash (or deletes them permanently). Only paths that
/// are part of the current scan, and never the scanned root itself, are
/// accepted, so the UI can't be tricked into removing arbitrary locations.
#[tauri::command]
async fn delete_items(
    state: State<'_, AppState>,
    paths: Vec<String>,
    permanent: bool,
) -> Result<Vec<DeleteOutcome>, String> {
    let mut outcomes = Vec::new();
    for path in paths {
        let segments = {
            let guard = state.result.read().unwrap();
            let result = guard.as_ref().ok_or("No scan available")?;
            match result.segments(&path) {
                Ok(s) if !s.is_empty() && result.root.find(&s).is_some() => s,
                _ => {
                    outcomes.push(DeleteOutcome {
                        path,
                        ok: false,
                        freed: 0,
                        error: Some("Not part of the current scan".into()),
                    });
                    continue;
                }
            }
        };

        let target = PathBuf::from(&path);
        let removed = if permanent {
            match std::fs::symlink_metadata(&target) {
                Ok(md) if md.is_dir() => std::fs::remove_dir_all(&target),
                Ok(_) => std::fs::remove_file(&target),
                Err(e) => Err(e),
            }
            .map_err(|e| e.to_string())
        } else {
            trash::delete(&target).map_err(|e| e.to_string())
        };

        match removed {
            Ok(()) => {
                let mut guard = state.result.write().unwrap();
                let freed = guard
                    .as_mut()
                    .and_then(|r| r.root.remove(&segments))
                    .map_or(0, |n| n.size);
                outcomes.push(DeleteOutcome {
                    path,
                    ok: true,
                    freed,
                    error: None,
                });
            }
            Err(error) => outcomes.push(DeleteOutcome {
                path,
                ok: false,
                freed: 0,
                error: Some(error),
            }),
        }
    }
    Ok(outcomes)
}

#[tauri::command]
fn reveal(path: String) -> Result<(), String> {
    tauri_plugin_opener::reveal_item_in_dir(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_item(path: String) -> Result<(), String> {
    tauri_plugin_opener::open_path(path, None::<&str>).map_err(|e| e.to_string())
}

/// Opens a link in the browser. Restricted to the project's GitHub pages.
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://github.com/") {
        return Err("URL not allowed".into());
    }
    tauri_plugin_opener::open_url(url, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_full_disk_access_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        tauri_plugin_opener::open_url(
            "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles",
            None::<&str>,
        )
        .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    Ok(())
}

/// Folder passed on the command line (`squirreldisk ~/Downloads`), if any.
#[tauri::command]
fn launch_path() -> Option<String> {
    std::env::args_os()
        .skip(1)
        .map(PathBuf::from)
        .find(|p| p.is_dir())
        .and_then(|p| p.canonicalize().ok())
        .map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
fn home_dir(app: AppHandle) -> Option<String> {
    app.path()
        .home_dir()
        .ok()
        .map(|p| p.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            list_disks,
            start_scan,
            cancel_scan,
            scan_summary,
            get_tree,
            largest_files,
            find_insights,
            delete_items,
            reveal,
            open_item,
            open_url,
            open_full_disk_access_settings,
            home_dir,
            launch_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running SquirrelDisk");
}
