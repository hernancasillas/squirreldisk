import type { ReactNode } from "react";
import { CheckIcon, FileIcon, FolderIcon } from "./Icons";

export interface Item {
  name: string;
  path: string;
  size: number;
  isDir: boolean;
}

export interface RowProps {
  item: Item;
  color: string;
  detail?: string;
  detailIsPath?: boolean;
  /** Small label next to the name, e.g. a cleanup suggestion. */
  badge?: ReactNode;
  /** False hides the checkbox (items that must be cleaned from their own app). */
  selectable?: boolean;
  percent: string;
  ratio: number;
  fmt: (n: number) => string;
  hovered: boolean;
  selected: boolean;
  onHover: (path: string | null) => void;
  onToggle: () => void;
  onOpen: () => void;
  onMenu: (x: number, y: number) => void;
}

export default function Row({ item, color, detail, detailIsPath, badge, selectable = true, percent, ratio, fmt, hovered, selected, onHover, onToggle, onOpen, onMenu }: RowProps) {
  return (
    <div
      className={"row" + (hovered ? " row-hover" : "") + (selected ? " row-selected" : "")}
      onMouseEnter={() => onHover(item.path)}
      onClick={onOpen}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu(e.clientX, e.clientY);
      }}
      title={item.path}
    >
      {selectable ? (
        <button
          className={"check" + (selected ? " checked" : "")}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-pressed={selected}
        >
          {selected && <CheckIcon width={12} height={12} />}
        </button>
      ) : (
        <span className="check-placeholder" />
      )}
      <span className="swatch" style={{ background: color }} />
      {item.isDir ? <FolderIcon className="row-icon" /> : <FileIcon className="row-icon muted" />}
      <div className="row-main">
        <div className="row-name">
          <span className="row-name-text">{item.name}</span>
          {badge}
        </div>
        {detail && <div className={"row-detail muted" + (detailIsPath ? " row-detail-path" : "")}>{detail}</div>}
        <div className="row-bar">
          <div style={{ width: `${Math.max(ratio * 100, 0.5)}%`, background: color }} />
        </div>
      </div>
      <div className="row-size">
        <div>{fmt(item.size)}</div>
        <div className="muted small">{percent}</div>
      </div>
    </div>
  );
}

