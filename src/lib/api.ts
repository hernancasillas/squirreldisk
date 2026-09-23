import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface Disk {
  name: string;
  mountPoint: string;
  fileSystem: string;
  totalSpace: number;
  availableSpace: number;
  isRemovable: boolean;
}

export interface TreeNode {
  name: string;
  path: string;
  size: number;
  files: number;
  isDir: boolean;
  unreadable: boolean;
  children?: TreeNode[];
  restCount: number;
  restSize: number;
}

export interface FileEntry {
  name: string;
  path: string;
  size: number;
}

export interface ScanProgress {
  files: number;
  dirs: number;
  bytes: number;
  errors: number;
  current: string;
  elapsedMs: number;
}

export interface ScanSummary {
  root: string;
  size: number;
  files: number;
  errors: number;
  durationMs: number;
}

export interface ScanDone {
  cancelled: boolean;
  partial: boolean;
  summary: ScanSummary | null;
}

export interface DeleteOutcome {
  path: string;
  ok: boolean;
  freed: number;
  error: string | null;
}

export const api = {
  listDisks: () => invoke<Disk[]>("list_disks"),
  startScan: (path: string, exclude: string[], refresh = false) =>
    invoke<void>("start_scan", { path, exclude, refresh }),
  cancelScan: () => invoke<void>("cancel_scan"),
  summary: () => invoke<ScanSummary | null>("scan_summary"),
  tree: (path: string, depth: number, minRatio: number, limit: number) =>
    invoke<TreeNode>("get_tree", { path, depth, minRatio, limit }),
  largestFiles: (path: string, limit: number) =>
    invoke<FileEntry[]>("largest_files", { path, limit }),
  deleteItems: (paths: string[], permanent: boolean) =>
    invoke<DeleteOutcome[]>("delete_items", { paths, permanent }),
  reveal: (path: string) => invoke<void>("reveal", { path }),
  open: (path: string) => invoke<void>("open_item", { path }),
  openUrl: (url: string) => invoke<void>("open_url", { url }),
  openFullDiskAccess: () => invoke<void>("open_full_disk_access_settings"),
  homeDir: () => invoke<string | null>("home_dir"),
  launchPath: () => invoke<string | null>("launch_path"),
};

export const onScanProgress = (cb: (p: ScanProgress) => void): Promise<UnlistenFn> =>
  listen<ScanProgress>("scan://progress", (e) => cb(e.payload));

export const onScanDone = (cb: (d: ScanDone) => void): Promise<UnlistenFn> =>
  listen<ScanDone>("scan://done", (e) => cb(e.payload));
