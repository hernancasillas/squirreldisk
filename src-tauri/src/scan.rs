//! Parallel directory scanner. Replaces the old `pdu` sidecar binary: it runs
//! in-process, reports live progress, can be cancelled at any time and builds
//! the tree directly instead of round-tripping a huge JSON document.

use crate::tree::Node;
use rayon::prelude::*;
use std::collections::HashSet;
use std::fs::{self, Metadata};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering::Relaxed};
use std::sync::Mutex;

#[derive(Default)]
pub struct Progress {
    pub files: AtomicU64,
    pub dirs: AtomicU64,
    pub bytes: AtomicU64,
    pub errors: AtomicU64,
    pub cancelled: AtomicBool,
    pub current: Mutex<String>,
}

impl Progress {
    pub fn cancel(&self) {
        self.cancelled.store(true, Relaxed);
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Relaxed)
    }
}

pub struct Options {
    pub root: PathBuf,
    /// Absolute paths that are never entered (other mount points, virtual
    /// file systems, user exclusions).
    pub skip: HashSet<PathBuf>,
}

const SHARDS: usize = 64;

struct Ctx<'a> {
    opts: &'a Options,
    progress: &'a Progress,
    /// File systems the scan may enter. Directories on any other device are
    /// mount points of other volumes (disk images, simulator runtimes,
    /// network shares...) and are skipped, like `du -x`.
    #[cfg_attr(not(unix), allow(dead_code))]
    devices: HashSet<u64>,
    /// (device, inode) of files with several hard links already counted.
    #[cfg_attr(not(unix), allow(dead_code))]
    seen_links: Vec<Mutex<HashSet<(u64, u64)>>>,
}

impl Ctx<'_> {
    /// Size the file occupies on disk. Sparse files (Docker, OrbStack, VM
    /// images) and cloud placeholders (iCloud, Dropbox, OneDrive) therefore
    /// report what they really use instead of their logical length.
    #[cfg(unix)]
    fn file_size(&self, md: &Metadata) -> u64 {
        use std::os::unix::fs::MetadataExt;
        let size = md.blocks() * 512;
        if md.nlink() > 1 && size > 0 {
            let key = (md.dev(), md.ino());
            let shard = (key.1 as usize ^ key.0 as usize) % SHARDS;
            if !self.seen_links[shard].lock().unwrap().insert(key) {
                return 0;
            }
        }
        size
    }

    #[cfg(windows)]
    fn file_size(&self, md: &Metadata) -> u64 {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_OFFLINE: u32 = 0x1000;
        const FILE_ATTRIBUTE_RECALL_ON_OPEN: u32 = 0x40000;
        const FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS: u32 = 0x400000;
        let attrs = md.file_attributes();
        if attrs
            & (FILE_ATTRIBUTE_OFFLINE
                | FILE_ATTRIBUTE_RECALL_ON_OPEN
                | FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS)
            != 0
        {
            // Cloud placeholder that is not downloaded (OneDrive, iCloud, ...).
            return 0;
        }
        md.len()
    }

    #[cfg(not(any(unix, windows)))]
    fn file_size(&self, md: &Metadata) -> u64 {
        md.len()
    }

    #[cfg(unix)]
    fn same_volume(&self, md: &Metadata) -> bool {
        use std::os::unix::fs::MetadataExt;
        self.devices.contains(&md.dev())
    }

    #[cfg(not(unix))]
    fn same_volume(&self, _md: &Metadata) -> bool {
        true
    }

    fn error(&self) {
        self.progress.errors.fetch_add(1, Relaxed);
    }
}

/// Scans `opts.root`. Returns `None` when the scan was cancelled.
pub fn scan(opts: &Options, progress: &Progress) -> Option<Node> {
    let md = match fs::symlink_metadata(&opts.root) {
        Ok(md) => md,
        Err(_) => {
            progress.errors.fetch_add(1, Relaxed);
            let mut node = Node::dir(opts.root.to_string_lossy().into());
            node.unreadable = true;
            return Some(node);
        }
    };
    let ctx = Ctx {
        opts,
        progress,
        devices: allowed_devices(&md),
        seen_links: (0..SHARDS).map(|_| Mutex::new(HashSet::new())).collect(),
    };
    let name: Box<str> = opts.root.to_string_lossy().into();
    let node = if md.is_dir() {
        scan_dir(&opts.root, name, &ctx)
    } else {
        Node::file(name, ctx.file_size(&md))
    };
    (!progress.is_cancelled()).then_some(node)
}

fn scan_dir(path: &Path, name: Box<str>, ctx: &Ctx) -> Node {
    let mut node = Node::dir(name);
    if ctx.progress.is_cancelled() {
        return node;
    }
    let dirs_seen = ctx.progress.dirs.fetch_add(1, Relaxed);
    if dirs_seen % 32 == 0 {
        if let Ok(mut current) = ctx.progress.current.try_lock() {
            *current = path.to_string_lossy().into_owned();
        }
    }

    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(_) => {
            ctx.error();
            node.unreadable = true;
            return node;
        }
    };

    let mut subdirs = Vec::new();
    let (mut files, mut bytes) = (0, 0);
    for entry in entries {
        let Ok(entry) = entry else {
            ctx.error();
            continue;
        };
        let name: Box<str> = entry.file_name().to_string_lossy().into();
        // DirEntry::metadata never follows symlinks and is served from the
        // directory listing on Windows, which is much faster than a stat.
        let Ok(md) = entry.metadata() else {
            ctx.error();
            continue;
        };
        if md.is_dir() {
            let child = entry.path();
            if ctx.same_volume(&md) && !ctx.opts.skip.contains(&child) {
                subdirs.push((child, name));
            }
        } else {
            let size = ctx.file_size(&md);
            files += 1;
            bytes += size;
            node.children.push(Node::file(name, size));
        }
    }
    ctx.progress.files.fetch_add(files, Relaxed);
    ctx.progress.bytes.fetch_add(bytes, Relaxed);

    let subdirs: Vec<Node> = subdirs
        .into_par_iter()
        .map(|(path, name)| scan_dir(&path, name, ctx))
        .collect();
    node.children.extend(subdirs);
    node.finalize();
    node
}

#[cfg(unix)]
fn allowed_devices(md: &Metadata) -> HashSet<u64> {
    use std::os::unix::fs::MetadataExt;
    let mut devices = HashSet::from([md.dev()]);
    // On macOS the boot disk is a read-only system volume plus a data volume
    // joined by firmlinks (/Users, /Applications, /Library, ...): both belong
    // to "Macintosh HD".
    if cfg!(target_os = "macos") {
        let on_system_volume = fs::metadata("/").is_ok_and(|m| m.dev() == md.dev());
        if on_system_volume {
            if let Ok(data) = fs::metadata("/System/Volumes/Data") {
                devices.insert(data.dev());
            }
        }
    }
    devices
}

#[cfg(not(unix))]
fn allowed_devices(_md: &Metadata) -> HashSet<u64> {
    HashSet::new()
}

/// Paths that must never be traversed when scanning `root`.
pub fn default_skips(root: &Path, mount_points: &[PathBuf]) -> HashSet<PathBuf> {
    let mut skip: HashSet<PathBuf> = mount_points
        .iter()
        .filter(|m| m.as_path() != root && m.starts_with(root))
        .cloned()
        .collect();

    #[cfg(target_os = "macos")]
    if root == Path::new("/") {
        // /System/Volumes/Data is reachable through firmlinks (/Users,
        // /Applications, ...); walking it as well would count everything twice.
        for p in ["/System/Volumes", "/Volumes", "/dev", "/net", "/home"] {
            skip.insert(PathBuf::from(p));
        }
    }

    #[cfg(target_os = "linux")]
    for p in ["/proc", "/sys", "/dev", "/run", "/tmp/.X11-unix"] {
        let p = PathBuf::from(p);
        if p.starts_with(root) && p != root {
            skip.insert(p);
        }
    }

    skip
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn write(path: &Path, bytes: usize) {
        let mut f = fs::File::create(path).unwrap();
        f.write_all(&vec![7u8; bytes]).unwrap();
        f.sync_all().unwrap();
    }

    #[test]
    fn scans_tree() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("a/b")).unwrap();
        fs::create_dir(root.join("empty")).unwrap();
        fs::create_dir(root.join("skipped")).unwrap();
        write(&root.join("a/b/big"), 200_000);
        write(&root.join("a/small"), 10);
        write(&root.join("skipped/huge"), 500_000);

        let opts = Options {
            root: root.to_path_buf(),
            skip: [root.join("skipped")].into_iter().collect(),
        };
        let progress = Progress::default();
        let tree = scan(&opts, &progress).unwrap();

        assert_eq!(tree.files, 2);
        assert!(tree.size >= 200_000);
        assert_eq!(&*tree.children[0].name, "a");
        let empty = tree.find(&["empty".into()]).unwrap();
        assert!(empty.is_dir, "empty folders must stay folders");
        assert!(tree.find(&["skipped".into()]).is_none());
        assert_eq!(progress.files.load(Relaxed), 2);
    }

    #[cfg(unix)]
    #[test]
    fn hard_links_counted_once() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        write(&root.join("one"), 100_000);
        fs::hard_link(root.join("one"), root.join("two")).unwrap();
        let opts = Options {
            root: root.to_path_buf(),
            skip: HashSet::new(),
        };
        let tree = scan(&opts, &Progress::default()).unwrap();
        let one = tree.find(&["one".into()]).unwrap().size;
        let two = tree.find(&["two".into()]).unwrap().size;
        assert_eq!(tree.files, 2);
        assert_eq!(one.min(two), 0);
        assert_eq!(tree.size, one.max(two));
    }

    #[cfg(unix)]
    #[test]
    fn symlinks_are_not_followed() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir(root.join("real")).unwrap();
        write(&root.join("real/data"), 100_000);
        std::os::unix::fs::symlink(root.join("real"), root.join("link")).unwrap();
        let opts = Options {
            root: root.to_path_buf(),
            skip: HashSet::new(),
        };
        let tree = scan(&opts, &Progress::default()).unwrap();
        assert!(!tree.find(&["link".into()]).unwrap().is_dir);
        assert_eq!(tree.files, 2);
    }

    #[test]
    fn cancel_returns_none() {
        let dir = tempfile::tempdir().unwrap();
        let progress = Progress::default();
        progress.cancel();
        let opts = Options {
            root: dir.path().to_path_buf(),
            skip: HashSet::new(),
        };
        assert!(scan(&opts, &progress).is_none());
    }

    #[test]
    fn skips_nested_mounts_only() {
        let mounts = vec![
            PathBuf::from("/"),
            PathBuf::from("/mnt/usb"),
            PathBuf::from("/other"),
        ];
        let skip = default_skips(Path::new("/mnt"), &mounts);
        assert!(skip.contains(Path::new("/mnt/usb")));
        assert!(!skip.contains(Path::new("/")));
        assert!(!skip.contains(Path::new("/other")));
    }
}

/// `SCAN_PATH=/some/dir cargo test --release -- --ignored --nocapture bench`
#[cfg(test)]
#[test]
#[ignore]
fn bench() {
    let root = PathBuf::from(std::env::var("SCAN_PATH").unwrap_or_else(|_| ".".into()));
    let opts = Options {
        skip: default_skips(&root, &crate::disks::mount_points()),
        root,
    };
    let progress = std::sync::Arc::new(Progress::default());
    let started = std::time::Instant::now();
    let p = progress.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(5));
        println!(
            "{:?} files={} current={}",
            started.elapsed(),
            p.files.load(Relaxed),
            p.current.lock().unwrap()
        );
    });
    let tree = scan(&opts, &progress).unwrap();
    let home = std::env::var_os("HOME").map(PathBuf::from);
    let mut totals: std::collections::BTreeMap<&str, (u64, usize)> = Default::default();
    for i in crate::insights::find(&tree, &opts.root, home.as_deref()) {
        let e = totals.entry(i.rule).or_default();
        e.0 += i.size;
        e.1 += 1;
    }
    let mut totals: Vec<_> = totals.into_iter().collect();
    totals.sort_by_key(|(_, (size, _))| std::cmp::Reverse(*size));
    for (rule, (size, n)) in totals {
        println!(
            "insight {rule:<24} {:>8.2} GB  ({n} items)",
            size as f64 / 1e9
        );
    }
    println!(
        "{} files, {} dirs, {} bytes, {} errors in {:?}",
        tree.files,
        progress.dirs.load(Relaxed),
        tree.size,
        progress.errors.load(Relaxed),
        started.elapsed()
    );
}
