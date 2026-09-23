import { useMemo, useState } from "react";
import type { Insight, InsightCategory, Safety } from "../lib/api";
import { formatNumber } from "../lib/format";
import { insightText } from "../lib/insights";
import { useSettings } from "../lib/settings";
import { useT, type Key } from "../lib/i18n";
import Row, { type Item } from "./Row";
import { ChevronIcon } from "./Icons";

const CATEGORY_KEY: Record<InsightCategory, Key> = {
  developer: "catDeveloper",
  design: "catDesign",
  browser: "catBrowser",
  apps: "catApps",
  system: "catSystem",
  downloads: "catDownloads",
};

// Folders that should be cleaned from their own app, not deleted directly.
const CLEAN_FROM_APP = new Set(["docker", "audio-libraries", "windows-old"]);

export function SafetyBadge({ safety, title }: { safety: Safety; title?: string }) {
  const t = useT();
  return (
    <span className={`badge badge-${safety}`} title={title}>
      {t(safety)}
    </span>
  );
}

interface Group {
  rule: string;
  safety: Safety;
  category: InsightCategory;
  size: number;
  items: Insight[];
}

interface Props {
  insights: Insight[];
  selected: Set<string>;
  fmt: (n: number) => string;
  onToggle: (item: Item) => void;
  onSelectMany: (items: Item[], select: boolean) => void;
  onOpen: (item: Item) => void;
  onMenu: (item: Item, x: number, y: number) => void;
}

export default function Suggestions({ insights, selected, fmt, onToggle, onSelectMany, onOpen, onMenu }: Props) {
  const { settings } = useSettings();
  const t = useT();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const i of insights) {
      let g = map.get(i.rule);
      if (!g) {
        g = { rule: i.rule, safety: i.safety, category: i.category, size: 0, items: [] };
        map.set(i.rule, g);
      }
      g.size += i.size;
      g.items.push(i);
    }
    return [...map.values()].sort((a, b) => b.size - a.size);
  }, [insights]);

  const total = groups.reduce((a, g) => a + g.size, 0);
  const safeTotal = groups.filter((g) => g.safety === "safe").reduce((a, g) => a + g.size, 0);

  if (groups.length === 0) return <div className="empty muted">{t("noSuggestions")}</div>;

  return (
    <div className="suggestions">
      <div className="suggestions-summary">
        <div className="suggestions-total">{t("canFree", { size: fmt(total) })}</div>
        {safeTotal > 0 && <div className="small safe-text">{t("safeTotal", { size: fmt(safeTotal) })}</div>}
        <div className="muted small">{t("suggestionsHint")}</div>
      </div>

      {groups.map((g) => {
        const text = insightText(settings.lang, g.rule);
        const items: Item[] = g.items.map((i) => ({ name: i.name, path: i.path, size: i.size, isDir: i.isDir }));
        const allSelected = items.every((i) => selected.has(i.path));
        const isOpen = g.items.length === 1 || expanded.has(g.rule);
        return (
          <div key={g.rule} className="suggestion">
            <div className="suggestion-head">
              <div className="suggestion-title">
                <strong>{text.title}</strong>
                <SafetyBadge safety={g.safety} />
              </div>
              <div className="suggestion-size">{fmt(g.size)}</div>
            </div>
            <div className="muted small suggestion-meta">
              {t(CATEGORY_KEY[g.category])}
              {g.items.length > 1 && ` · ${formatNumber(g.items.length, settings.lang)}`}
            </div>
            <p className="suggestion-desc small">{text.desc}</p>
            <div className="suggestion-actions">
              {!CLEAN_FROM_APP.has(g.rule) && (
                <button className="btn btn-small" onClick={() => onSelectMany(items, !allSelected)}>
                  {allSelected ? t("deselectAll") : t("selectAll")}
                </button>
              )}
              {g.items.length > 1 && (
                <button
                  className="link small suggestion-toggle"
                  onClick={() =>
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(g.rule)) next.delete(g.rule);
                      else next.add(g.rule);
                      return next;
                    })
                  }
                >
                  <ChevronIcon width={12} height={12} className={isOpen ? "rot90" : ""} />
                  {isOpen ? t("hideItems") : t("showItems", { n: g.items.length })}
                </button>
              )}
            </div>
            {isOpen &&
              items.map((item) => (
                <Row
                  key={item.path}
                  item={item}
                  color={g.safety === "safe" ? "var(--ok)" : "var(--warn)"}
                  detail={item.path}
                  detailIsPath
                  selectable={!CLEAN_FROM_APP.has(g.rule)}
                  percent=""
                  ratio={g.size > 0 ? item.size / g.size : 0}
                  fmt={fmt}
                  hovered={false}
                  selected={selected.has(item.path)}
                  onHover={() => {}}
                  onToggle={() => onToggle(item)}
                  onOpen={() => onOpen(item)}
                  onMenu={(x, y) => onMenu(item, x, y)}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}
