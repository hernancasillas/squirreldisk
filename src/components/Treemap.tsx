import { memo, useEffect, useMemo, useRef, useState } from "react";
import { treemap, treemapSquarify, type HierarchyRectangularNode } from "d3-hierarchy";
import { fillFor, toHierarchy, type ChartDatum } from "../lib/chart";
import type { ChartProps } from "./Sunburst";

type Node = HierarchyRectangularNode<ChartDatum>;

const HEADER = 18;
const MAX_DEPTH = 4;

function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

function Treemap(props: ChartProps) {
  const { tree, hues, hovered, selected, animation, restLabel, formatSize } = props;
  const [ref, { width, height }] = useSize<HTMLDivElement>();

  const nodes = useMemo(() => {
    if (width < 10 || height < 10) return [];
    const root = treemap<ChartDatum>()
      .size([width, height])
      .tile(treemapSquarify.ratio(1.2))
      .paddingOuter(3)
      .paddingInner(2)
      .paddingTop((d) => (d.depth > 0 && d.depth < MAX_DEPTH && (d.y1 - d.y0) > HEADER * 2 ? HEADER : 3))
      .round(true)(toHierarchy(tree, restLabel));
    return root
      .descendants()
      .filter((d) => d.depth > 0 && d.depth <= MAX_DEPTH && d.x1 - d.x0 >= 2 && d.y1 - d.y0 >= 2);
  }, [tree, restLabel, width, height]);

  const hoveredAncestors = useMemo(() => {
    if (!hovered) return null;
    const node = nodes.find((n) => n.data.path === hovered);
    return node ? new Set(node.ancestors().map((a) => a.data.path)) : null;
  }, [hovered, nodes]);

  const label = (d: Node) => {
    const w = d.x1 - d.x0;
    const h = d.y1 - d.y0;
    const isGroup = !!d.children && d.depth < MAX_DEPTH;
    if (w < 40 || h < 14) return null;
    if (!isGroup && h < 30) return null;
    const maxChars = Math.floor((w - 10) / 6.2);
    const name = d.data.name.length > maxChars ? d.data.name.slice(0, Math.max(maxChars - 1, 1)) + "…" : d.data.name;
    const size = formatSize(d.value ?? 0);
    return isGroup ? (
      <text x={d.x0 + 5} y={d.y0 + 13} className="tm-label tm-label-group">
        {name}
        {w > 140 && <tspan className="tm-size"> {size}</tspan>}
      </text>
    ) : (
      <>
        <text x={d.x0 + 5} y={d.y0 + 15} className="tm-label">
          {name}
        </text>
        {h > 34 && (
          <text x={d.x0 + 5} y={d.y0 + 29} className="tm-label tm-size">
            {size}
          </text>
        )}
      </>
    );
  };

  return (
    <div ref={ref} className="treemap" onMouseLeave={() => props.onHover(null)}>
      <svg width={width} height={height} className={`chart-anim-${animation}`} key={tree.path}>
        {nodes.map((d) => {
          const dim = hoveredAncestors && !hoveredAncestors.has(d.data.path);
          return (
            <g key={d.data.path}>
              <rect
                x={d.x0}
                y={d.y0}
                width={d.x1 - d.x0}
                height={d.y1 - d.y0}
                rx={3}
                fill={fillFor(d, hues)}
                className={
                  "tm-rect" +
                  (d.children ? " tm-group" : "") +
                  (dim ? " arc-dim" : "") +
                  (selected.has(d.data.path) ? " arc-selected" : "")
                }
                onClick={(e) => {
                  e.stopPropagation();
                  // Zoom into the clicked folder, or the folder holding the clicked file.
                  const target = d.data.isDir && !d.data.isRest ? d : d.parent;
                  if (target && target.depth >= 1) props.onFocus(target.data.path);
                }}
                onMouseMove={(e) => props.onHover(d.data, e)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!d.data.isRest) props.onContextMenu(d.data, e);
                }}
              />
              {label(d)}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default memo(Treemap);
