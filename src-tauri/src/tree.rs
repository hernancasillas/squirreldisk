//! In-memory representation of a scanned directory tree and the queries the UI
//! runs against it. The full tree never leaves the Rust side: the frontend asks
//! for small, pruned views of it, which keeps huge disks responsive.

use serde::Serialize;
use std::cmp::Reverse;
use std::collections::BinaryHeap;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone)]
pub struct Node {
    pub name: Box<str>,
    /// Bytes this entry occupies on disk (allocated size, hard links counted once).
    pub size: u64,
    /// Number of files contained (1 for a file).
    pub files: u64,
    pub is_dir: bool,
    /// The directory could not be read (permission denied, vanished, ...).
    pub unreadable: bool,
    /// Children sorted by size, largest first.
    pub children: Vec<Node>,
}

impl Node {
    pub fn file(name: Box<str>, size: u64) -> Self {
        Node {
            name,
            size,
            files: 1,
            is_dir: false,
            unreadable: false,
            children: Vec::new(),
        }
    }

    pub fn dir(name: Box<str>) -> Self {
        Node {
            name,
            size: 0,
            files: 0,
            is_dir: true,
            unreadable: false,
            children: Vec::new(),
        }
    }

    /// Recomputes totals from the children and sorts them, largest first.
    pub fn finalize(&mut self) {
        if !self.is_dir {
            return;
        }
        self.size = self.children.iter().map(|c| c.size).sum();
        self.files = self.children.iter().map(|c| c.files).sum();
        self.sort_children();
        self.children.shrink_to_fit();
    }

    fn sort_children(&mut self) {
        self.children
            .sort_unstable_by(|a, b| b.size.cmp(&a.size).then_with(|| a.name.cmp(&b.name)));
    }

    pub fn find(&self, segments: &[String]) -> Option<&Node> {
        let mut node = self;
        for segment in segments {
            node = node.children.iter().find(|c| *c.name == **segment)?;
        }
        Some(node)
    }

    /// Removes the node at `segments` and updates every ancestor's totals.
    /// Returns the removed node.
    pub fn remove(&mut self, segments: &[String]) -> Option<Node> {
        let (first, rest) = segments.split_first()?;
        let index = self.children.iter().position(|c| *c.name == **first)?;
        let removed = if rest.is_empty() {
            self.children.remove(index)
        } else {
            let removed = self.children[index].remove(rest)?;
            self.sort_children();
            removed
        };
        self.size = self.size.saturating_sub(removed.size);
        self.files = self.files.saturating_sub(removed.files);
        Some(removed)
    }

    /// Replaces the node at `segments` with `replacement` (used when a single
    /// folder is rescanned) and updates every ancestor's totals.
    pub fn replace(&mut self, segments: &[String], replacement: Node) -> bool {
        let Some((first, rest)) = segments.split_first() else {
            *self = replacement;
            return true;
        };
        let Some(index) = self.children.iter().position(|c| *c.name == **first) else {
            return false;
        };
        let (old_size, old_files) = (self.children[index].size, self.children[index].files);
        if !self.children[index].replace(rest, replacement) {
            return false;
        }
        let child = &self.children[index];
        self.size = self.size.saturating_sub(old_size) + child.size;
        self.files = self.files.saturating_sub(old_files) + child.files;
        self.sort_children();
        true
    }
}

/// Splits `path` into the child names leading from `root` to it.
/// Returns `None` when `path` is not inside `root`.
pub fn relative_segments(root: &Path, path: &Path) -> Option<Vec<String>> {
    let rel = path.strip_prefix(root).ok()?;
    let mut segments = Vec::new();
    for component in rel.components() {
        match component {
            Component::Normal(name) => segments.push(name.to_string_lossy().into_owned()),
            Component::CurDir => {}
            _ => return None,
        }
    }
    Some(segments)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewNode {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub files: u64,
    pub is_dir: bool,
    pub unreadable: bool,
    /// Present only when this level was expanded.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<ViewNode>>,
    /// Children folded away because they were too small or past the limit.
    pub rest_count: u64,
    pub rest_size: u64,
}

pub struct ViewOptions {
    pub depth: u32,
    /// Children smaller than this many bytes are folded into `rest_*`.
    pub min_size: u64,
    /// Maximum number of children listed per directory.
    pub limit: usize,
}

pub fn view(node: &Node, path: &Path, opts: &ViewOptions) -> ViewNode {
    let mut out = ViewNode {
        name: node.name.to_string(),
        path: path.to_string_lossy().into_owned(),
        size: node.size,
        files: node.files,
        is_dir: node.is_dir,
        unreadable: node.unreadable,
        children: None,
        rest_count: 0,
        rest_size: 0,
    };
    if opts.depth == 0 || !node.is_dir {
        return out;
    }
    let child_opts = ViewOptions {
        depth: opts.depth - 1,
        min_size: opts.min_size,
        limit: opts.limit,
    };
    let mut children = Vec::new();
    for child in &node.children {
        if children.len() < opts.limit && child.size >= opts.min_size {
            children.push(view(child, &path.join(&*child.name), &child_opts));
        } else {
            out.rest_count += 1;
            out.rest_size += child.size;
        }
    }
    out.children = Some(children);
    out
}

#[derive(Debug, Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub size: u64,
    pub path: String,
    pub name: String,
}

/// The `limit` largest files anywhere below `node`, largest first.
pub fn largest_files(node: &Node, path: &Path, limit: usize) -> Vec<FileEntry> {
    fn walk(
        node: &Node,
        path: &mut PathBuf,
        limit: usize,
        heap: &mut BinaryHeap<Reverse<(u64, String, String)>>,
    ) {
        for child in &node.children {
            // Children are sorted by size: once one is too small, so are the rest.
            if heap.len() == limit && heap.peek().is_some_and(|m| child.size <= m.0 .0) {
                break;
            }
            path.push(&*child.name);
            if child.is_dir {
                walk(child, path, limit, heap);
            } else {
                heap.push(Reverse((
                    child.size,
                    path.to_string_lossy().into_owned(),
                    child.name.to_string(),
                )));
                if heap.len() > limit {
                    heap.pop();
                }
            }
            path.pop();
        }
    }
    if limit == 0 {
        return Vec::new();
    }
    let mut heap = BinaryHeap::with_capacity(limit + 1);
    walk(node, &mut path.to_path_buf(), limit, &mut heap);
    let mut files: Vec<FileEntry> = heap
        .into_iter()
        .map(|Reverse((size, path, name))| FileEntry { size, path, name })
        .collect();
    files.sort_unstable_by(|a, b| b.cmp(a));
    files
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Node {
        let mut docs = Node::dir("docs".into());
        docs.children = vec![
            Node::file("a.pdf".into(), 300),
            Node::file("b.txt".into(), 5),
        ];
        docs.finalize();
        let mut root = Node::dir("root".into());
        root.children = vec![
            docs,
            Node::file("movie.mkv".into(), 1000),
            Node::file("tiny".into(), 1),
        ];
        root.finalize();
        root
    }

    fn segs(s: &[&str]) -> Vec<String> {
        s.iter().map(|x| x.to_string()).collect()
    }

    #[test]
    fn totals_and_order() {
        let root = sample();
        assert_eq!(root.size, 1306);
        assert_eq!(root.files, 4);
        assert_eq!(&*root.children[0].name, "movie.mkv");
        assert_eq!(root.find(&segs(&["docs", "a.pdf"])).unwrap().size, 300);
        assert!(root.find(&segs(&["nope"])).is_none());
    }

    #[test]
    fn remove_updates_ancestors() {
        let mut root = sample();
        let removed = root.remove(&segs(&["docs", "a.pdf"])).unwrap();
        assert_eq!(removed.size, 300);
        assert_eq!(root.size, 1006);
        assert_eq!(root.files, 3);
        assert_eq!(root.find(&segs(&["docs"])).unwrap().size, 5);
        assert!(root.remove(&segs(&["docs", "a.pdf"])).is_none());
    }

    #[test]
    fn replace_updates_ancestors() {
        let mut root = sample();
        let mut docs = Node::dir("docs".into());
        docs.children = vec![Node::file("big.iso".into(), 5000)];
        docs.finalize();
        assert!(root.replace(&segs(&["docs"]), docs));
        assert_eq!(root.size, 6001);
        assert_eq!(root.files, 3);
        assert_eq!(&*root.children[0].name, "docs");
    }

    #[test]
    fn view_folds_small_children() {
        let root = sample();
        let v = view(
            &root,
            Path::new("/r"),
            &ViewOptions {
                depth: 2,
                min_size: 10,
                limit: 100,
            },
        );
        let children = v.children.unwrap();
        assert_eq!(children.len(), 2);
        assert_eq!(v.rest_count, 1);
        assert_eq!(v.rest_size, 1);
        let docs = children.iter().find(|c| c.name == "docs").unwrap();
        assert_eq!(docs.path, Path::new("/r").join("docs").to_string_lossy());
        assert_eq!(docs.rest_count, 1);
    }

    #[test]
    fn largest_files_are_ranked() {
        let root = sample();
        let files = largest_files(&root, Path::new("/r"), 2);
        let names: Vec<_> = files.iter().map(|f| f.name.as_str()).collect();
        assert_eq!(names, ["movie.mkv", "a.pdf"]);
    }

    #[test]
    fn relative_segments_work() {
        let root = Path::new("/a/b");
        assert_eq!(
            relative_segments(root, Path::new("/a/b/c/d")).unwrap(),
            segs(&["c", "d"])
        );
        assert!(relative_segments(root, Path::new("/a/b"))
            .unwrap()
            .is_empty());
        assert!(relative_segments(root, Path::new("/x")).is_none());
    }
}
