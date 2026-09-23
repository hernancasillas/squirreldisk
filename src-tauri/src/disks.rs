use serde::Serialize;
use std::path::PathBuf;
use sysinfo::Disks;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub file_system: String,
    pub total_space: u64,
    pub available_space: u64,
    pub is_removable: bool,
}

/// Mount points that only mirror another volume or are pure system
/// plumbing; listing them would just show the same data twice.
fn is_hidden(mount: &str, fs: &str, total: u64) -> bool {
    if total == 0 {
        return true;
    }
    if cfg!(target_os = "macos") {
        return mount.starts_with("/System/Volumes/") || mount.starts_with("/private/var/vm");
    }
    if cfg!(target_os = "linux") {
        return matches!(
            fs,
            "squashfs" | "tmpfs" | "devtmpfs" | "overlay" | "efivarfs"
        ) || mount.starts_with("/boot")
            || mount.starts_with("/snap/")
            || mount.starts_with("/var/snap/")
            || mount.starts_with("/run/")
            || mount.starts_with("/sys")
            || mount.starts_with("/proc");
    }
    false
}

pub fn list() -> Vec<DiskInfo> {
    let disks = Disks::new_with_refreshed_list();
    let mut out: Vec<DiskInfo> = disks
        .list()
        .iter()
        .filter_map(|d| {
            let mount_point = d.mount_point().to_string_lossy().into_owned();
            let file_system = d.file_system().to_string_lossy().into_owned();
            if is_hidden(&mount_point, &file_system, d.total_space()) {
                return None;
            }
            Some(DiskInfo {
                name: d.name().to_string_lossy().into_owned(),
                mount_point,
                file_system,
                total_space: d.total_space(),
                available_space: d.available_space(),
                is_removable: d.is_removable(),
            })
        })
        .collect();
    out.sort_by(|a, b| {
        a.is_removable
            .cmp(&b.is_removable)
            .then_with(|| a.mount_point.len().cmp(&b.mount_point.len()))
            .then_with(|| a.mount_point.cmp(&b.mount_point))
    });
    out.dedup_by(|a, b| a.mount_point == b.mount_point);
    out
}

pub fn mount_points() -> Vec<PathBuf> {
    Disks::new_with_refreshed_list()
        .list()
        .iter()
        .map(|d| d.mount_point().to_path_buf())
        .collect()
}
