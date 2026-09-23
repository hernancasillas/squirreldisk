export type UnitBase = 1000 | 1024;

const UNITS_SI = ["B", "kB", "MB", "GB", "TB", "PB"];
// Windows Explorer labels binary sizes with the familiar KB/MB/GB names.
const UNITS_BIN = ["B", "KB", "MB", "GB", "TB", "PB"];

export function formatBytes(bytes: number, base: UnitBase = 1000): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = base === 1000 ? UNITS_SI : UNITS_BIN;
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1);
  const value = bytes / Math.pow(base, exp);
  const digits = exp === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[exp]}`;
}

export function formatNumber(n: number, locale?: string): string {
  return new Intl.NumberFormat(locale).format(n);
}

export function formatPercent(part: number, total: number): string {
  if (total <= 0) return "0%";
  const p = (part / total) * 100;
  if (p > 0 && p < 0.1) return "<0.1%";
  return `${p.toFixed(p >= 10 ? 0 : 1)}%`;
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${(ms / 1000).toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

/** Splits an absolute path into its parent directory and base name. */
export function splitPath(path: string): { parent: string; name: string } {
  const trimmed = path.length > 1 ? path.replace(/[\\/]+$/, "") : path;
  const idx = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  if (idx < 0) return { parent: "", name: trimmed };
  return { parent: trimmed.slice(0, idx + 1), name: trimmed.slice(idx + 1) };
}

/** Breadcrumb entries from `root` down to `path` (both absolute). */
export function breadcrumbs(root: string, path: string): { name: string; path: string }[] {
  const crumbs = [{ name: root, path: root }];
  if (path === root || !path.startsWith(root)) return crumbs;
  const sep = root.includes("\\") || path.includes("\\") ? "\\" : "/";
  const rest = path.slice(root.length).split(/[\\/]/).filter(Boolean);
  let current = root;
  for (const name of rest) {
    current = current.endsWith(sep) || current.endsWith("/") ? current + name : current + sep + name;
    crumbs.push({ name, path: current });
  }
  return crumbs;
}

export function joinPath(dir: string, name: string): string {
  const sep = dir.includes("\\") ? "\\" : "/";
  return dir.endsWith("/") || dir.endsWith("\\") ? dir + name : dir + sep + name;
}

/** Parent of `path`, or null when `path` is `root`. */
export function parentPath(root: string, path: string): string | null {
  if (path === root) return null;
  const { parent } = splitPath(path);
  if (!parent || parent.length < root.length) return root;
  const p = parent.length > 1 && parent !== root ? parent.replace(/[\\/]+$/, "") : parent;
  return p.length < root.length ? root : p;
}

export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.replace(/^v/, "").split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}
