import { hierarchy, type HierarchyNode } from "d3-hierarchy";
import type { TreeNode } from "./api";
import { colorFor, hueFor, REST_COLOR } from "./colors";

export interface ChartDatum {
  name: string;
  path: string;
  size: number;
  files: number;
  isDir: boolean;
  /** Synthetic slice standing for all the children too small to draw. */
  isRest: boolean;
  restCount: number;
  children?: ChartDatum[];
}

export const REST_SUFFIX = "\u0000rest";

function toDatum(node: TreeNode, restLabel: (n: number) => string): ChartDatum {
  const children = node.children?.map((c) => toDatum(c, restLabel));
  if (children && node.restSize > 0) {
    children.push({
      name: restLabel(node.restCount),
      path: node.path + REST_SUFFIX,
      size: node.restSize,
      files: 0,
      isDir: false,
      isRest: true,
      restCount: node.restCount,
    });
  }
  return {
    name: node.name,
    path: node.path,
    size: node.size,
    files: node.files,
    isDir: node.isDir,
    isRest: false,
    restCount: node.restCount,
    children,
  };
}

export function toHierarchy(tree: TreeNode, restLabel: (n: number) => string): HierarchyNode<ChartDatum> {
  return hierarchy(toDatum(tree, restLabel), (d) => d.children)
    .sum((d) => (d.children && d.children.length > 0 ? 0 : d.size))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
}

/** Hue of each direct child of the focused folder, keyed by path. */
export function huesFor(tree: TreeNode | null): Map<string, number> {
  const map = new Map<string, number>();
  tree?.children?.forEach((c, i) => map.set(c.path, hueFor(i)));
  return map;
}

export function fillFor(node: HierarchyNode<ChartDatum>, hues: Map<string, number>): string {
  if (node.data.isRest) return REST_COLOR;
  let top = node;
  while (top.depth > 1 && top.parent) top = top.parent;
  const hue = hues.get(top.data.path);
  if (hue === undefined) return REST_COLOR;
  const sibling = node.parent?.children?.indexOf(node) ?? 0;
  return colorFor(hue, node.depth, node.data.isDir, sibling);
}
