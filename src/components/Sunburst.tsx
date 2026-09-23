import { memo, useMemo } from "react";
import { partition, type HierarchyRectangularNode } from "d3-hierarchy";
import { arc as d3arc } from "d3-shape";
import type { TreeNode } from "../lib/api";
import { fillFor, toHierarchy, type ChartDatum } from "../lib/chart";
import { splitPath } from "../lib/format";

type Node = HierarchyRectangularNode<ChartDatum>;

export interface ChartProps {
  tree: TreeNode;
  hues: Map<string, number>;
  hovered: string | null;
  selected: Set<string>;
  animation: "in" | "out" | "none";
  restLabel: (n: number) => string;
  /** Name shown in the middle of the chart (defaults to the folder name). */
  centerLabel?: string;
  formatSize: (n: number) => string;
  onFocus: (path: string) => void;
  onUp: () => void;
  onHover: (node: ChartDatum | null, event?: React.MouseEvent) => void;
  onContextMenu: (node: ChartDatum, event: React.MouseEvent) => void;
}

const SIZE = 600;
const RINGS = 4;
const CENTER = 92;
const OUTER = SIZE / 2 - 6;
const RING = (OUTER - CENTER) / RINGS;

const inner = (d: Node) => CENTER + (d.y0 - 1) * RING;
const outer = (d: Node) => CENTER + (d.y1 - 1) * RING - 1.5;

const arcPath = d3arc<Node>()
  .startAngle((d) => d.x0)
  .endAngle((d) => d.x1)
  .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.004))
  .padRadius(OUTER)
  .innerRadius(inner)
  .outerRadius(outer)
  .cornerRadius(2);

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return maxChars <= 1 ? "" : text.slice(0, maxChars - 1) + "…";
}

function Sunburst(props: ChartProps) {
  const { tree, hues, hovered, selected, animation, restLabel, formatSize } = props;

  const nodes = useMemo(() => {
    const root = partition<ChartDatum>().size([2 * Math.PI, RINGS + 1])(toHierarchy(tree, restLabel));
    return root.descendants().filter((d) => d.depth > 0 && d.depth <= RINGS && d.x1 - d.x0 > 0.0025);
  }, [tree, restLabel]);

  const hoveredAncestors = useMemo(() => {
    if (!hovered) return null;
    const node = nodes.find((n) => n.data.path === hovered);
    return node ? new Set(node.ancestors().map((a) => a.data.path)) : null;
  }, [hovered, nodes]);

  return (
    <svg
      className="chart-svg"
      viewBox={`${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`}
      onMouseLeave={() => props.onHover(null)}
      role="img"
    >
      <g key={tree.path} className={`chart-anim-${animation}`}>
        {nodes.map((d) => {
          const dim = hoveredAncestors && !hoveredAncestors.has(d.data.path);
          return (
            <path
              key={d.data.path}
              d={arcPath(d) ?? undefined}
              fill={fillFor(d, hues)}
              className={
                "arc" +
                (d.data.isDir && d.children ? " arc-dir" : "") +
                (dim ? " arc-dim" : "") +
                (selected.has(d.data.path) ? " arc-selected" : "")
              }
              onClick={() => d.data.isDir && !d.data.isRest && props.onFocus(d.data.path)}
              onMouseMove={(e) => props.onHover(d.data, e)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!d.data.isRest) props.onContextMenu(d.data, e);
              }}
            />
          );
        })}
        {nodes.map((d) => {
          // Radial labels where the slice is wide enough to hold text.
          const mid = (inner(d) + outer(d)) / 2;
          if ((d.x1 - d.x0) * mid < 13 || d.data.isRest) return null;
          const angle = (((d.x0 + d.x1) / 2) * 180) / Math.PI;
          const chars = Math.floor((outer(d) - inner(d) - 8) / 5.6);
          const label = truncate(d.data.name, chars);
          if (!label) return null;
          return (
            <text
              key={"t" + d.data.path}
              className="arc-label"
              transform={`rotate(${angle - 90}) translate(${mid},0) rotate(${angle < 180 ? 0 : 180})`}
              dy="0.35em"
            >
              {label}
            </text>
          );
        })}
      </g>
      <g
        className="chart-center"
        onClick={props.onUp}
        onMouseMove={(e) =>
          props.onHover(
            {
              name: tree.name,
              path: tree.path,
              size: tree.size,
              files: tree.files,
              isDir: true,
              isRest: false,
              restCount: tree.restCount,
            },
            e,
          )
        }
      >
        <circle r={CENTER - 6} />
        <text className="center-name" y={-10}>
          {truncate(props.centerLabel ?? (splitPath(tree.name).name || tree.name), 16)}
        </text>
        <text className="center-size" y={14}>
          {formatSize(tree.size)}
        </text>
      </g>
    </svg>
  );
}

export default memo(Sunburst);
