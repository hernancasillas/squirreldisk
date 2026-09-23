import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ask, message } from "@tauri-apps/plugin-dialog";
import {
  api,
  onScanDone,
  onScanProgress,
  type FileEntry,
  type Insight,
  type ScanProgress,
  type ScanSummary,
  type TreeNode,
} from "../lib/api";
import { breadcrumbs, formatBytes, formatDuration, formatNumber, formatPercent, parentPath } from "../lib/format";
import { huesFor, type ChartDatum } from "../lib/chart";
import { colorFor, FREE_COLOR, REST_COLOR } from "../lib/colors";
import { isMac, isWindows } from "../lib/platform";
import { useSettings } from "../lib/settings";
import { useT } from "../lib/i18n";
import { insightText } from "../lib/insights";
import type { Target } from "../App";
import Sunburst from "./Sunburst";
import Treemap from "./Treemap";
import ContextMenu, { type MenuItem } from "./ContextMenu";
import Row, { type Item } from "./Row";
import Suggestions, { SafetyBadge } from "./Suggestions";
import {
  ArrowUpIcon,
  ChevronIcon,
  RefreshIcon,
  SunburstIcon,
  TrashIcon,
  TreemapIcon,
  WarnIcon,
} from "./Icons";

interface Props {
  target: Target;
  summary: ScanSummary;
  onHome: () => void;
}

interface Tooltip {
  x: number;
  y: number;
  node: ChartDatum;
}

const CHART_MIN_RATIO = 0.002;

export default function Results({ target, summary: initialSummary, onHome }: Props) {
  const { settings, update } = useSettings();
  const t = useT();
  const fmt = useCallback((n: number) => formatBytes(n, settings.unitBase), [settings.unitBase]);
  const restLabel = useCallback((n: number) => t("smallerItems", { n: formatNumber(n, settings.lang) }), [t, settings.lang]);

  const root = initialSummary.root;
  const [summary, setSummary] = useState(initialSummary);
  const [focus, setFocus] = useState(root);
  const [animation, setAnimation] = useState<"in" | "out" | "none">("none");
  const [chartTree, setChartTree] = useState<TreeNode | null>(null);
  const [listTree, setListTree] = useState<TreeNode | null>(null);
  const [largest, setLargest] = useState<FileEntry[] | null>(null);
  const [tab, setTab] = useState<"contents" | "largest" | "suggestions">("contents");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [version, setVersion] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [selection, setSelection] = useState<Map<string, Item>>(new Map());
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<ScanProgress | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Load the chart and the list whenever the focus or the data changes.
  useEffect(() => {
    let alive = true;
    const depth = 4;
    Promise.all([
      api.tree(focus, depth, CHART_MIN_RATIO, 150),
      api.tree(focus, 1, 0, 5000),
    ])
      .then(([chart, list]) => {
        if (!alive) return;
        setChartTree(chart);
        setListTree(list);
      })
      .catch(() => {
        // The focused folder vanished (deleted/rescanned): go back to the root.
        if (alive && focus !== root) setFocus(root);
      });
    return () => {
      alive = false;
    };
  }, [focus, version, root, settings.chart]);

  useEffect(() => {
    if (tab !== "largest") return;
    let alive = true;
    setLargest(null);
    api.largestFiles(focus, 300).then((files) => alive && setLargest(files));
    return () => {
      alive = false;
    };
  }, [tab, focus, version]);

  useEffect(() => {
    let alive = true;
    api
      .insights()
      .then((found) => alive && setInsights(found))
      .catch(() => alive && setInsights([]));
    return () => {
      alive = false;
    };
  }, [version]);

  // Suggestions inside the focused folder, and a quick lookup for list badges.
  const focusInsights = useMemo(
    () =>
      focus === root
        ? insights
        : insights.filter((i) => i.path === focus || i.path.startsWith(focus + "/") || i.path.startsWith(focus + "\\")),
    [insights, focus, root],
  );
  const insightByPath = useMemo(() => new Map(insights.map((i) => [i.path, i])), [insights]);
  // Total suggested size inside each folder between the focus and the matches.
  const cleanableIn = useMemo(() => {
    const totals = new Map<string, number>();
    for (const i of focusInsights) {
      let p = parentPath(root, i.path);
      while (p !== null && p.length > focus.length) {
        totals.set(p, (totals.get(p) ?? 0) + i.size);
        p = parentPath(root, p);
      }
    }
    return totals;
  }, [focusInsights, focus, root]);

  const hues = useMemo(() => huesFor(chartTree), [chartTree]);

  const focusOn = useCallback(
    (path: string) => {
      setAnimation(path.length >= focus.length ? "in" : "out");
      setFocus(path);
      setTooltip(null);
    },
    [focus],
  );

  const goUp = useCallback(() => {
    const parent = parentPath(root, focus);
    if (parent !== null) focusOn(parent);
  }, [root, focus, focusOn]);

  const toggleSelect = useCallback((item: Item) => {
    setSelection((prev) => {
      const next = new Map(prev);
      if (next.has(item.path)) next.delete(item.path);
      else addToSelection(next, item);
      return next;
    });
  }, []);

  const selectMany = useCallback((items: Item[], select: boolean) => {
    setSelection((prev) => {
      const next = new Map(prev);
      for (const item of items) {
        if (!select) next.delete(item.path);
        else if (!next.has(item.path)) addToSelection(next, item);
      }
      return next;
    });
  }, []);

  const selectedPaths = useMemo(() => new Set(selection.keys()), [selection]);
  const selectedSize = useMemo(() => [...selection.values()].reduce((a, b) => a + b.size, 0), [selection]);

  const deleteSelection = useCallback(
    async (permanent: boolean) => {
      if (selection.size === 0) return;
      const vars = { n: selection.size, size: fmt(selectedSize) };
      const ok = await ask(t(permanent ? "confirmDelete" : "confirmTrash", vars), {
        title: t(permanent ? "deletePermanently" : "moveToTrash"),
        kind: "warning",
        okLabel: t(permanent ? "deletePermanently" : "moveToTrash"),
        cancelLabel: t("cancel"),
      });
      if (!ok) return;
      setBusy(t("deleting"));
      try {
        const results = await api.deleteItems([...selection.keys()], permanent);
        const failed = results.filter((r) => !r.ok);
        const freed = results.reduce((a, r) => a + r.freed, 0);
        setSelection((prev) => {
          const next = new Map(prev);
          results.forEach((r) => r.ok && next.delete(r.path));
          return next;
        });
        const fresh = await api.summary();
        if (fresh) setSummary(fresh);
        setVersion((v) => v + 1);
        setNotice(t("freed", { size: fmt(freed) }));
        if (failed.length > 0) {
          await message(failed.map((f) => `${f.path}\n  ${f.error}`).join("\n\n"), {
            title: t("deleteFailed", { n: failed.length }),
            kind: "error",
          });
        }
      } finally {
        setBusy(null);
      }
    },
    [selection, selectedSize, fmt, t],
  );

  // Rescan only the focused folder and splice the result in.
  const rescan = useCallback(
    async (path: string) => {
      setRefreshing({ files: 0, dirs: 0, bytes: 0, errors: 0, current: path, elapsedMs: 0 });
      const unProgress = await onScanProgress(setRefreshing);
      const unDone = await onScanDone(async (done) => {
        unProgress();
        unDone();
        setRefreshing(null);
        if (done.summary) setSummary(done.summary);
        setVersion((v) => v + 1);
      });
      try {
        await api.startScan(path, settings.exclude, true);
      } catch (e) {
        unProgress();
        unDone();
        setRefreshing(null);
        await message(String(e), { title: t("scanFailed"), kind: "error" });
      }
    },
    [settings.exclude, t],
  );

  const revealLabel = isMac ? t("revealMac") : isWindows ? t("revealWin") : t("revealLinux");

  const openMenu = useCallback(
    (item: Item, x: number, y: number) => {
      const isSelected = selection.has(item.path);
      const items: MenuItem[] = [
        ...(item.isDir && item.path !== focus ? [{ label: t("open"), action: () => focusOn(item.path) }] : []),
        { label: revealLabel, action: () => api.reveal(item.path) },
        ...(!item.isDir ? [{ label: t("open"), action: () => api.open(item.path) }] : []),
        { label: t("copyPath"), action: () => navigator.clipboard.writeText(item.path) },
        { separator: true },
        ...(item.path !== root
          ? [{ label: isSelected ? t("deselect") : t("select"), action: () => toggleSelect(item) }]
          : []),
        ...(item.isDir ? [{ label: t("rescan"), action: () => rescan(item.path) }] : []),
        ...(item.isDir && item.path !== root
          ? [
              {
                label: t("exclude"),
                action: () => {
                  if (!settings.exclude.includes(item.path)) update({ exclude: [...settings.exclude, item.path] });
                },
              },
            ]
          : []),
      ];
      setMenu({ x, y, items });
    },
    [selection, focus, root, revealLabel, t, focusOn, toggleSelect, rescan, settings.exclude, update],
  );

  // Keyboard: Backspace / Escape / Cmd+Up go up; Delete moves the selection to the Trash.
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    if (menu || busy || (e.target as HTMLElement).closest("input, textarea")) return;
    if (e.key === "Backspace" && (e.metaKey || e.ctrlKey) && selection.size > 0) {
      e.preventDefault();
      deleteSelection(false);
    } else if (e.key === "Escape" || e.key === "Backspace" || (e.key === "ArrowUp" && (e.metaKey || e.altKey))) {
      e.preventDefault();
      goUp();
    } else if (e.key === "Delete" && selection.size > 0) {
      e.preventDefault();
      deleteSelection(e.shiftKey);
    }
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(id);
  }, [notice]);

  const onChartHover = useCallback((node: ChartDatum | null, e?: React.MouseEvent) => {
    setHovered(node && !node.isRest ? node.path : null);
    setTooltip(node && e ? { x: e.clientX, y: e.clientY, node } : null);
  }, []);

  const onChartMenu = useCallback(
    (node: ChartDatum, e: React.MouseEvent) =>
      openMenu({ name: node.name, path: node.path, size: node.size, isDir: node.isDir }, e.clientX, e.clientY),
    [openMenu],
  );

  const crumbs = breadcrumbs(root, focus);
  const disk = target.disk && target.disk.mountPoint === root ? target.disk : null;
  const Chart = settings.chart === "sunburst" ? Sunburst : Treemap;
  const focusSize = listTree?.size ?? 0;

  return (
    <div className="results">
      <div className="toolbar">
        <button className="icon-btn" onClick={goUp} disabled={focus === root} title={t("up")} aria-label={t("up")}>
          <ArrowUpIcon />
        </button>
        <nav className="crumbs">
          <button className="crumb" onClick={onHome}>
            {t("allDisks")}
          </button>
          {crumbs.map((c, i) => (
            <span key={c.path} className="crumb-wrap">
              <ChevronIcon width={12} height={12} className="muted" />
              <button className={"crumb" + (i === crumbs.length - 1 ? " crumb-current" : "")} onClick={() => focusOn(c.path)}>
                {i === 0 && disk?.name ? `${disk.name} (${c.name})` : c.name}
              </button>
            </span>
          ))}
        </nav>
        <div className="toolbar-actions">
          <button className="icon-btn" onClick={() => rescan(focus)} title={t("rescan")} aria-label={t("rescan")} disabled={!!refreshing}>
            <RefreshIcon className={refreshing ? "spin" : ""} />
          </button>
          <div className="segmented">
            <button
              className={settings.chart === "sunburst" ? "active" : ""}
              onClick={() => update({ chart: "sunburst" })}
              title={t("sunburst")}
            >
              <SunburstIcon />
            </button>
            <button
              className={settings.chart === "treemap" ? "active" : ""}
              onClick={() => update({ chart: "treemap" })}
              title={t("treemap")}
            >
              <TreemapIcon />
            </button>
          </div>
        </div>
      </div>

      <div className="results-body">
        <div className="chart-area">
          {chartTree && (
            <Chart
              tree={chartTree}
              hues={hues}
              hovered={hovered}
              selected={selectedPaths}
              animation={animation}
              restLabel={restLabel}
              centerLabel={focus === root && disk?.name ? disk.name : undefined}
              formatSize={fmt}
              onFocus={focusOn}
              onUp={goUp}
              onHover={onChartHover}
              onContextMenu={onChartMenu}
            />
          )}
          {settings.chart === "sunburst" && focus !== root && <div className="chart-hint muted small">{t("centerHint")}</div>}
          {refreshing && (
            <div className="refresh-overlay">
              <RefreshIcon className="spin" /> {formatNumber(refreshing.files, settings.lang)} {t("files")} ·{" "}
              {fmt(refreshing.bytes)}
            </div>
          )}
        </div>

        <aside className="panel">
          <div className="panel-summary">
            <div className="panel-summary-row">
              <div>
                <div className="panel-size">{fmt(summary.size)}</div>
                <div className="muted small">
                  {t("scannedIn", {
                    files: formatNumber(summary.files, settings.lang),
                    time: formatDuration(summary.durationMs),
                  })}
                </div>
              </div>
            </div>
            {disk && <SpaceBar disk={disk} scanned={summary.size} fmt={fmt} />}
            {summary.errors > 0 && (
              <div className="warning small">
                <WarnIcon width={14} height={14} />
                <span>{t("unreadable", { n: formatNumber(summary.errors, settings.lang) })}</span>
                {isMac && (
                  <button className="link" onClick={() => api.openFullDiskAccess()} title={t("grantAccessHint")}>
                    {t("grantAccess")}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="tabs">
            <button className={tab === "contents" ? "active" : ""} onClick={() => setTab("contents")}>
              {t("contents")}
            </button>
            <button className={tab === "largest" ? "active" : ""} onClick={() => setTab("largest")}>
              {t("tabLargest")}
            </button>
            <button className={tab === "suggestions" ? "active" : ""} onClick={() => setTab("suggestions")}>
              {t("suggestions")}
              {focusInsights.length > 0 && (
                <span className="tab-count">{fmt(focusInsights.reduce((a, i) => a + i.size, 0))}</span>
              )}
            </button>
          </div>

          <div className="list" onMouseLeave={() => setHovered(null)}>
            {tab === "contents" &&
              listTree?.children?.map((c) => {
                const hue = hues.get(c.path);
                const insight = insightByPath.get(c.path);
                return (
                  <Row
                    key={c.path}
                    item={c}
                    color={hue === undefined ? REST_COLOR : colorFor(hue, 1, c.isDir)}
                    detail={
                      c.unreadable
                        ? t("noAccess")
                        : c.isDir
                          ? t("filesCount", { n: formatNumber(c.files, settings.lang) })
                          : undefined
                    }
                    badge={
                      insight ? (
                        <SafetyBadge
                          safety={insight.safety}
                          title={`${insightText(settings.lang, insight.rule).title}: ${insightText(settings.lang, insight.rule).desc}`}
                        />
                      ) : cleanableIn.has(c.path) ? (
                        <span className="badge badge-hint">{t("cleanable", { size: fmt(cleanableIn.get(c.path)!) })}</span>
                      ) : undefined
                    }
                    percent={formatPercent(c.size, focusSize)}
                    ratio={focusSize > 0 ? c.size / focusSize : 0}
                    fmt={fmt}
                    hovered={hovered === c.path}
                    selected={selection.has(c.path)}
                    onHover={setHovered}
                    onToggle={() => toggleSelect(c)}
                    onOpen={() => (c.isDir ? focusOn(c.path) : api.reveal(c.path))}
                    onMenu={(x, y) => openMenu(c, x, y)}
                  />
                );
              })}
            {tab === "contents" && listTree && (listTree.children?.length ?? 0) === 0 && listTree.restCount === 0 && (
              <div className="empty muted">{t("emptyFolder")}</div>
            )}
            {tab === "contents" && listTree && listTree.restCount > 0 && (
              <div className="row row-rest muted small">
                {restLabel(listTree.restCount)} · {fmt(listTree.restSize)}
              </div>
            )}
            {tab === "suggestions" && (
              <Suggestions
                insights={focusInsights}
                selected={selectedPaths}
                fmt={fmt}
                onToggle={toggleSelect}
                onSelectMany={selectMany}
                onOpen={(item) => (item.isDir ? focusOn(item.path) : api.reveal(item.path))}
                onMenu={(item, x, y) => openMenu(item, x, y)}
              />
            )}
            {tab === "largest" && largest === null && <div className="empty muted">{t("loading")}</div>}
            {tab === "largest" &&
              largest?.map((f) => (
                <Row
                  key={f.path}
                  item={{ ...f, isDir: false }}
                  color={REST_COLOR}
                  detail={f.path}
                  detailIsPath
                  percent={formatPercent(f.size, focusSize)}
                  ratio={focusSize > 0 ? f.size / focusSize : 0}
                  fmt={fmt}
                  hovered={false}
                  selected={selection.has(f.path)}
                  onHover={() => {}}
                  onToggle={() => toggleSelect({ ...f, isDir: false })}
                  onOpen={() => api.reveal(f.path)}
                  onMenu={(x, y) => openMenu({ ...f, isDir: false }, x, y)}
                />
              ))}
          </div>

          <div className={"selection-bar" + (selection.size > 0 ? " visible" : "")}>
            {selection.size === 0 ? (
              <span className="muted small">{t("selectHint")}</span>
            ) : (
              <>
                <div className="selection-info">
                  <strong>{t("selected", { n: selection.size, size: fmt(selectedSize) })}</strong>
                  <button className="link small" onClick={() => setSelection(new Map())}>
                    {t("clear")}
                  </button>
                </div>
                <div className="selection-actions">
                  <button className="btn btn-danger" disabled={!!busy} onClick={() => deleteSelection(false)}>
                    <TrashIcon /> {busy ?? t("moveToTrash")}
                  </button>
                  <button className="btn btn-ghost small" disabled={!!busy} onClick={() => deleteSelection(true)}>
                    {t("deletePermanently")}
                  </button>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      {tooltip && (
        <div
          className="tooltip"
          style={{
            left: Math.min(tooltip.x + 14, window.innerWidth - 300),
            top: Math.min(tooltip.y + 14, window.innerHeight - 90),
          }}
        >
          <div className="tooltip-name">{tooltip.node.name}</div>
          <div>
            <strong>{fmt(tooltip.node.size)}</strong>
            <span className="muted">
              {" · "}
              {t("ofParent", {
                p: formatPercent(tooltip.node.size, chartTree?.size ?? 0),
                parent: chartTree?.name ?? "",
              })}
            </span>
          </div>
          {tooltip.node.isDir && (
            <div className="muted small">{t("filesCount", { n: formatNumber(tooltip.node.files, settings.lang) })}</div>
          )}
        </div>
      )}
      {menu && <ContextMenu {...menu} onClose={() => setMenu(null)} />}
      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}

function SpaceBar({ disk, scanned, fmt }: { disk: NonNullable<Target["disk"]>; scanned: number; fmt: (n: number) => string }) {
  const t = useT();
  const total = disk.totalSpace;
  const used = total - disk.availableSpace;
  const shown = Math.min(scanned, used);
  const other = Math.max(used - shown, 0);
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="spacebar">
      <div className="spacebar-track">
        <div style={{ width: pct(shown), background: "var(--accent)" }} />
        <div style={{ width: pct(other), background: REST_COLOR }} />
        <div style={{ width: pct(disk.availableSpace), background: FREE_COLOR }} />
      </div>
      <div className="spacebar-legend small">
        <span>
          <i style={{ background: "var(--accent)" }} /> {t("scanned")} {fmt(shown)}
        </span>
        <span title={t("otherHint")}>
          <i style={{ background: REST_COLOR }} /> {t("other")} {fmt(other)}
        </span>
        <span>
          <i style={{ background: FREE_COLOR }} /> {t("freeSpace")} {fmt(disk.availableSpace)}
        </span>
      </div>
    </div>
  );
}

/** Adds `item` unless a selected folder already contains it; drops selected items inside it. */
function addToSelection(selection: Map<string, Item>, item: Item) {
  const inside = (child: string, parent: string) => child.startsWith(parent + "/") || child.startsWith(parent + "\\");
  for (const p of selection.keys()) {
    if (inside(item.path, p)) return;
    if (inside(p, item.path)) selection.delete(p);
  }
  selection.set(item.path, item);
}
