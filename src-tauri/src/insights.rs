//! Cleanup suggestions: a curated list of well-known folders (build outputs,
//! package manager caches, app caches, device backups...) matched against the
//! scanned tree. Everything runs locally; the UI supplies the explanations.

use crate::tree::Node;
use serde::Serialize;
use std::collections::HashSet;
use std::path::{Component, Path, PathBuf};

#[derive(Clone, Copy, Serialize, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum Safety {
    /// Regenerated automatically; deleting it only costs a rebuild/redownload.
    Safe,
    /// May hold things the user wants to keep, or should be cleaned from its app.
    Review,
}

#[derive(Clone, Copy, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub enum Category {
    Developer,
    Design,
    Browser,
    Apps,
    System,
    Downloads,
}

enum Matcher {
    /// Path relative to the home folder. Segments may be `*` (any name) or
    /// `*.ext` (name ending in `.ext`).
    Home(&'static str),
    /// Absolute path, same wildcard syntax.
    Abs(&'static str),
    /// A folder with this name anywhere, optionally only when one of
    /// `siblings` exists next to it (e.g. `target` next to `Cargo.toml`).
    Name(&'static str, &'static [&'static str]),
}

struct Rule {
    id: &'static str,
    category: Category,
    safety: Safety,
    /// Operating systems the rule applies to; empty means all.
    os: &'static [&'static str],
    matchers: &'static [Matcher],
}

use Category::*;
use Matcher::*;
use Safety::*;

const MAC: &[&str] = &["macos"];
const WIN: &[&str] = &["windows"];
const LINUX: &[&str] = &["linux"];
const ALL: &[&str] = &[];

static RULES: &[Rule] = &[
    // ---------- Developer ----------
    Rule { id: "xcode-derived-data", category: Developer, safety: Safe, os: MAC, matchers: &[Home("Library/Developer/Xcode/DerivedData")] },
    Rule {
        id: "xcode-device-support",
        category: Developer,
        safety: Safe,
        os: MAC,
        matchers: &[
            Home("Library/Developer/Xcode/iOS DeviceSupport"),
            Home("Library/Developer/Xcode/watchOS DeviceSupport"),
            Home("Library/Developer/Xcode/tvOS DeviceSupport"),
            Home("Library/Developer/Xcode/visionOS DeviceSupport"),
        ],
    },
    Rule { id: "xcode-archives", category: Developer, safety: Review, os: MAC, matchers: &[Home("Library/Developer/Xcode/Archives")] },
    Rule { id: "xcode-previews", category: Developer, safety: Safe, os: MAC, matchers: &[Home("Library/Developer/Xcode/UserData/Previews")] },
    Rule { id: "xcode-cache", category: Developer, safety: Safe, os: MAC, matchers: &[Home("Library/Caches/com.apple.dt.Xcode")] },
    Rule { id: "simulator-devices", category: Developer, safety: Review, os: MAC, matchers: &[Home("Library/Developer/CoreSimulator/Devices")] },
    Rule { id: "simulator-caches", category: Developer, safety: Safe, os: MAC, matchers: &[Home("Library/Developer/CoreSimulator/Caches")] },
    Rule {
        id: "cocoapods-cache",
        category: Developer,
        safety: Safe,
        os: MAC,
        matchers: &[Home("Library/Caches/CocoaPods"), Name("Pods", &["Podfile"])],
    },
    Rule { id: "node-modules", category: Developer, safety: Safe, os: ALL, matchers: &[Name("node_modules", &[])] },
    Rule {
        id: "js-build",
        category: Developer,
        safety: Safe,
        os: ALL,
        matchers: &[Name(".next", &["package.json"]), Name(".nuxt", &["package.json"]), Name(".turbo", &["package.json"]), Name(".parcel-cache", &["package.json"])],
    },
    Rule {
        id: "npm-cache",
        category: Developer,
        safety: Safe,
        os: ALL,
        matchers: &[
            Home(".npm/_cacache"),
            Home("AppData/Local/npm-cache"),
            Home("Library/Caches/Yarn"),
            Home(".cache/yarn"),
            Home("AppData/Local/Yarn/Cache"),
            Home("Library/Caches/pnpm"),
            Home("Library/pnpm/store"),
            Home(".local/share/pnpm/store"),
            Home("AppData/Local/pnpm/store"),
            Home(".bun/install/cache"),
        ],
    },
    Rule { id: "rust-target", category: Developer, safety: Safe, os: ALL, matchers: &[Name("target", &["Cargo.toml"])] },
    Rule { id: "cargo-registry", category: Developer, safety: Safe, os: ALL, matchers: &[Home(".cargo/registry"), Home(".cargo/git")] },
    Rule {
        id: "gradle",
        category: Developer,
        safety: Safe,
        os: ALL,
        matchers: &[Home(".gradle/caches"), Home(".gradle/wrapper/dists"), Name("build", &["build.gradle", "build.gradle.kts"]), Name(".gradle", &["settings.gradle", "settings.gradle.kts", "gradlew"])],
    },
    Rule { id: "android-avd", category: Developer, safety: Review, os: ALL, matchers: &[Home(".android/avd")] },
    Rule {
        id: "flutter",
        category: Developer,
        safety: Safe,
        os: ALL,
        matchers: &[Name(".dart_tool", &["pubspec.yaml"]), Home(".pub-cache"), Home("AppData/Local/Pub/Cache")],
    },
    Rule {
        id: "python-cache",
        category: Developer,
        safety: Safe,
        os: ALL,
        matchers: &[Name("__pycache__", &[]), Name(".pytest_cache", &[]), Name(".mypy_cache", &[]), Home("Library/Caches/pip"), Home(".cache/pip"), Home("AppData/Local/pip/Cache")],
    },
    Rule { id: "python-venv", category: Developer, safety: Review, os: ALL, matchers: &[Name(".venv", &[]), Name("venv", &["requirements.txt", "pyproject.toml", "setup.py"])] },
    Rule {
        id: "go-cache",
        category: Developer,
        safety: Safe,
        os: ALL,
        matchers: &[Home("Library/Caches/go-build"), Home(".cache/go-build"), Home("AppData/Local/go-build"), Home("go/pkg/mod")],
    },
    Rule { id: "homebrew-cache", category: Developer, safety: Safe, os: MAC, matchers: &[Home("Library/Caches/Homebrew")] },
    Rule {
        id: "docker",
        category: Developer,
        safety: Review,
        os: ALL,
        matchers: &[Home("Library/Containers/com.docker.docker/Data/vms"), Home("AppData/Local/Docker/wsl"), Home(".orbstack/data")],
    },
    Rule {
        id: "ide-caches",
        category: Developer,
        safety: Safe,
        os: ALL,
        matchers: &[
            Home("Library/Caches/JetBrains"),
            Home(".cache/JetBrains"),
            Home("AppData/Local/JetBrains"),
            Home("Library/Caches/Google/AndroidStudio*"),
            Home("Library/Application Support/Code/Cache"),
            Home("Library/Application Support/Code/CachedData"),
            Home("Library/Application Support/Code/CachedExtensionVSIXs"),
            Home("AppData/Roaming/Code/Cache"),
            Home("AppData/Roaming/Code/CachedData"),
            Home(".config/Code/Cache"),
            Home(".config/Code/CachedData"),
        ],
    },
    // ---------- Design & media ----------
    Rule {
        id: "adobe-media-cache",
        category: Design,
        safety: Safe,
        os: ALL,
        matchers: &[
            Home("Library/Application Support/Adobe/Common/Media Cache Files"),
            Home("Library/Application Support/Adobe/Common/Media Cache"),
            Home("Library/Application Support/Adobe/Common/Peak Files"),
            Home("AppData/Roaming/Adobe/Common/Media Cache Files"),
            Home("AppData/Roaming/Adobe/Common/Media Cache"),
            Home("AppData/Roaming/Adobe/Common/Peak Files"),
        ],
    },
    Rule { id: "adobe-caches", category: Design, safety: Safe, os: ALL, matchers: &[Home("Library/Caches/Adobe"), Home("AppData/Local/Adobe/*/Cache")] },
    Rule {
        id: "final-cut-render",
        category: Design,
        safety: Safe,
        os: MAC,
        matchers: &[Home("Movies/*.fcpbundle/*/Render Files"), Home("Movies/*.fcpbundle/*/*/Render Files")],
    },
    Rule {
        id: "final-cut-transcoded",
        category: Design,
        safety: Review,
        os: MAC,
        matchers: &[Home("Movies/*.fcpbundle/*/Transcoded Media"), Home("Movies/*.fcpbundle/*/*/Transcoded Media")],
    },
    Rule { id: "figma-cache", category: Design, safety: Safe, os: ALL, matchers: &[Home("Library/Caches/com.figma.Desktop"), Home("AppData/Local/Figma/app-*/Cache")] },
    Rule {
        id: "audio-libraries",
        category: Design,
        safety: Review,
        os: MAC,
        matchers: &[Abs("/Library/Application Support/Logic"), Abs("/Library/Application Support/GarageBand")],
    },
    // ---------- Browsers ----------
    Rule {
        id: "browser-cache",
        category: Browser,
        safety: Safe,
        os: ALL,
        matchers: &[
            Home("Library/Caches/Google/Chrome"),
            Home("Library/Caches/BraveSoftware"),
            Home("Library/Caches/Microsoft Edge"),
            Home("Library/Caches/Firefox"),
            Home("Library/Caches/com.operasoftware.Opera"),
            Home("Library/Caches/company.thebrowser.Browser"),
            Home("AppData/Local/Google/Chrome/User Data/*/Cache"),
            Home("AppData/Local/Google/Chrome/User Data/*/Code Cache"),
            Home("AppData/Local/Microsoft/Edge/User Data/*/Cache"),
            Home("AppData/Local/Microsoft/Edge/User Data/*/Code Cache"),
            Home("AppData/Local/BraveSoftware/Brave-Browser/User Data/*/Cache"),
            Home("AppData/Local/Mozilla/Firefox/Profiles/*/cache2"),
            Home(".cache/google-chrome"),
            Home(".cache/chromium"),
            Home(".cache/mozilla"),
        ],
    },
    // ---------- Apps ----------
    Rule {
        id: "chat-caches",
        category: Apps,
        safety: Safe,
        os: ALL,
        matchers: &[
            Home("Library/Application Support/Slack/Cache"),
            Home("Library/Application Support/Slack/Service Worker/CacheStorage"),
            Home("Library/Containers/com.tinyspeck.slackmacgap/Data/Library/Application Support/Slack/Cache"),
            Home("Library/Containers/com.tinyspeck.slackmacgap/Data/Library/Application Support/Slack/Service Worker/CacheStorage"),
            Home("Library/Application Support/discord/Cache"),
            Home("Library/Containers/com.microsoft.teams2/Data/Library/Caches"),
            Home("AppData/Roaming/Slack/Cache"),
            Home("AppData/Roaming/Slack/Service Worker/CacheStorage"),
            Home("AppData/Roaming/discord/Cache"),
            Home(".config/Slack/Cache"),
            Home(".config/discord/Cache"),
        ],
    },
    Rule {
        id: "spotify-cache",
        category: Apps,
        safety: Safe,
        os: ALL,
        matchers: &[Home("Library/Caches/com.spotify.client"), Home("Library/Application Support/Spotify/PersistentCache"), Home("AppData/Local/Spotify/Data"), Home(".cache/spotify")],
    },
    Rule { id: "ios-backups", category: Apps, safety: Review, os: ALL, matchers: &[Home("Library/Application Support/MobileSync/Backup"), Home("AppData/Roaming/Apple Computer/MobileSync/Backup"), Home("Apple/MobileSync/Backup")] },
    Rule { id: "ios-updates", category: Apps, safety: Safe, os: MAC, matchers: &[Home("Library/iTunes/iPhone Software Updates"), Home("Library/iTunes/iPad Software Updates")] },
    Rule { id: "mail-downloads", category: Apps, safety: Safe, os: MAC, matchers: &[Home("Library/Containers/com.apple.mail/Data/Library/Mail Downloads")] },
    Rule { id: "messages-attachments", category: Apps, safety: Review, os: MAC, matchers: &[Home("Library/Messages/Attachments")] },
    // ---------- System ----------
    Rule { id: "logs", category: System, safety: Safe, os: MAC, matchers: &[Home("Library/Logs")] },
    Rule { id: "temp", category: System, safety: Safe, os: WIN, matchers: &[Home("AppData/Local/Temp"), Home("AppData/Local/CrashDumps")] },
    Rule { id: "windows-old", category: System, safety: Review, os: WIN, matchers: &[Abs("C:/Windows.old")] },
    Rule { id: "linux-cache", category: System, safety: Safe, os: LINUX, matchers: &[Home(".cache/thumbnails"), Home(".local/share/Trash")] },
    // ---------- Downloads ----------
    Rule {
        id: "installers",
        category: Downloads,
        safety: Review,
        os: ALL,
        matchers: &[
            Home("Downloads/*.dmg"),
            Home("Downloads/*.pkg"),
            Home("Downloads/*.iso"),
            Home("Downloads/*.xip"),
            Home("Downloads/*.exe"),
            Home("Downloads/*.msi"),
            Home("Downloads/*.deb"),
            Home("Downloads/*.rpm"),
            Home("Downloads/*.AppImage"),
        ],
    },
];

/// Folders under this size are not worth suggesting.
const MIN_SIZE: u64 = 1_000_000;
const MAX_RESULTS: usize = 3000;

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Insight {
    pub rule: &'static str,
    pub category: Category,
    pub safety: Safety,
    pub path: String,
    pub name: String,
    pub size: u64,
    pub files: u64,
    pub is_dir: bool,
}

fn segments_of(path: &Path) -> Vec<String> {
    path.components()
        .filter_map(|c| match c {
            Component::Prefix(p) => Some(p.as_os_str().to_string_lossy().into_owned()),
            Component::Normal(n) => Some(n.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect()
}

fn names_equal(a: &str, b: &str) -> bool {
    if cfg!(any(windows, target_os = "macos")) {
        // Both are case-insensitive by default.
        a.eq_ignore_ascii_case(b)
    } else {
        a == b
    }
}

fn segment_matches(pattern: &str, name: &str) -> bool {
    if pattern == "*" {
        return true;
    }
    if let Some(prefix) = pattern.strip_suffix('*') {
        return name.len() >= prefix.len() && names_equal(&name[..prefix.len()], prefix);
    }
    if let Some(suffix) = pattern.strip_prefix('*') {
        return name.len() >= suffix.len()
            && name.is_char_boundary(name.len() - suffix.len())
            && names_equal(&name[name.len() - suffix.len()..], suffix);
    }
    names_equal(pattern, name)
}

fn applies(rule: &Rule) -> bool {
    rule.os.is_empty() || rule.os.contains(&std::env::consts::OS)
}

struct Found<'a> {
    rule: &'static Rule,
    node: &'a Node,
    path: PathBuf,
}

/// Follows `pattern` (already past the scan root) down the tree.
fn walk_pattern<'a>(
    node: &'a Node,
    path: &mut PathBuf,
    pattern: &[String],
    rule: &'static Rule,
    out: &mut Vec<Found<'a>>,
) {
    let Some((first, rest)) = pattern.split_first() else {
        out.push(Found {
            rule,
            node,
            path: path.clone(),
        });
        return;
    };
    let wildcard = first.contains('*');
    for child in &node.children {
        if segment_matches(first, &child.name) {
            path.push(&*child.name);
            walk_pattern(child, path, rest, rule, out);
            path.pop();
            if !wildcard {
                break;
            }
        }
    }
}

pub fn find(root: &Node, root_path: &Path, home: Option<&Path>) -> Vec<Insight> {
    let root_segments = segments_of(root_path);
    let mut found: Vec<Found> = Vec::new();

    // Path rules: follow each pattern directly instead of visiting every node.
    for rule in RULES.iter().filter(|r| applies(r)) {
        for matcher in rule.matchers {
            let full = match matcher {
                Home(rel) => match home {
                    Some(home) => {
                        let mut s = segments_of(home);
                        s.extend(rel.split('/').map(String::from));
                        s
                    }
                    None => continue,
                },
                Abs(abs) => segments_of(Path::new(abs)),
                Name(..) => continue,
            };
            // The scan root must be above the pattern target.
            if full.len() <= root_segments.len()
                || !root_segments
                    .iter()
                    .zip(&full)
                    .all(|(r, p)| segment_matches(p, r))
            {
                continue;
            }
            walk_pattern(
                root,
                &mut root_path.to_path_buf(),
                &full[root_segments.len()..],
                rule,
                &mut found,
            );
        }
    }

    // Name rules: one pass over the tree, not entering folders already matched.
    let claimed: HashSet<PathBuf> = found.iter().map(|f| f.path.clone()).collect();
    let name_rules: Vec<(&'static Rule, &'static str, &'static [&'static str])> = RULES
        .iter()
        .filter(|r| applies(r))
        .flat_map(|r| {
            r.matchers.iter().filter_map(move |m| match m {
                Name(name, siblings) => Some((r, *name, *siblings)),
                _ => None,
            })
        })
        .collect();

    fn visit<'a>(
        node: &'a Node,
        path: &mut PathBuf,
        rules: &[(&'static Rule, &'static str, &'static [&'static str])],
        claimed: &HashSet<PathBuf>,
        out: &mut Vec<Found<'a>>,
    ) {
        for child in node.children.iter().filter(|c| c.is_dir) {
            if child.size < MIN_SIZE {
                // Children are sorted by size: nothing big enough follows.
                break;
            }
            path.push(&*child.name);
            let hit = rules.iter().find(|(_, name, siblings)| {
                *child.name == **name
                    && (siblings.is_empty()
                        || node
                            .children
                            .iter()
                            .any(|s| siblings.iter().any(|x| *s.name == **x)))
            });
            if let Some((rule, ..)) = hit {
                out.push(Found {
                    rule,
                    node: child,
                    path: path.clone(),
                });
            } else if !claimed.contains(path.as_path()) {
                visit(child, path, rules, claimed, out);
            }
            path.pop();
        }
    }
    visit(
        root,
        &mut root_path.to_path_buf(),
        &name_rules,
        &claimed,
        &mut found,
    );

    // When matches nest (e.g. node_modules inside an app cache), keep the outer one.
    found.sort_by_key(|f| f.path.as_os_str().len());
    let mut kept: HashSet<PathBuf> = HashSet::new();
    let mut insights = Vec::new();
    for f in found {
        if f.node.size < MIN_SIZE || f.path.ancestors().any(|a| kept.contains(a)) {
            continue;
        }
        kept.insert(f.path.clone());
        insights.push(Insight {
            rule: f.rule.id,
            category: f.rule.category,
            safety: f.rule.safety,
            path: f.path.to_string_lossy().into_owned(),
            name: f.node.name.to_string(),
            size: f.node.size,
            files: f.node.files,
            is_dir: f.node.is_dir,
        });
    }
    insights.sort_by_key(|i| std::cmp::Reverse(i.size));
    insights.truncate(MAX_RESULTS);
    insights
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file(name: &str, size: u64) -> Node {
        Node::file(name.into(), size)
    }

    fn dir(name: &str, children: Vec<Node>) -> Node {
        let mut n = Node::dir(name.into());
        n.children = children;
        n.finalize();
        n
    }

    const MB: u64 = 1_000_000;

    fn sample() -> Node {
        dir(
            "home",
            vec![
                dir(
                    "projects",
                    vec![
                        dir(
                            "web",
                            vec![
                                file("package.json", 1),
                                dir(
                                    "node_modules",
                                    vec![
                                        dir(
                                            "left-pad",
                                            vec![dir("node_modules", vec![file("x", 5 * MB)])],
                                        ),
                                        file("big", 50 * MB),
                                    ],
                                ),
                            ],
                        ),
                        dir(
                            "game",
                            vec![
                                file("Cargo.toml", 1),
                                dir("target", vec![file("app", 80 * MB)]),
                            ],
                        ),
                        dir("notes", vec![dir("target", vec![file("goals.md", 3 * MB)])]),
                    ],
                ),
                dir(
                    "Downloads",
                    vec![file("Setup.DMG", 20 * MB), file("photo.jpg", 9 * MB)],
                ),
                dir(
                    ".cargo",
                    vec![dir("registry", vec![file("crate", 40 * MB)])],
                ),
                dir("tiny", vec![dir("node_modules", vec![file("a", 10)])]),
            ],
        )
    }

    #[test]
    fn finds_known_folders() {
        let root = sample();
        let home = Path::new("/home");
        let found = find(&root, home, Some(home));
        let rules: Vec<_> = found.iter().map(|i| (i.rule, i.name.as_str())).collect();

        assert!(rules.contains(&("rust-target", "target")));
        assert!(rules.contains(&("node-modules", "node_modules")));
        assert!(rules.contains(&("cargo-registry", "registry")));
        // `target` without Cargo.toml next to it is not a Rust build folder.
        assert_eq!(found.iter().filter(|i| i.rule == "rust-target").count(), 1);
        // Nested node_modules are part of the outer match, tiny ones are skipped.
        assert_eq!(found.iter().filter(|i| i.rule == "node-modules").count(), 1);
        // Largest first.
        assert_eq!(found[0].rule, "rust-target");
    }

    #[test]
    fn installers_in_downloads_are_case_insensitive_on_mac_and_windows() {
        let root = sample();
        let home = Path::new("/home");
        let found = find(&root, home, Some(home));
        let has = found
            .iter()
            .any(|i| i.rule == "installers" && i.name == "Setup.DMG");
        assert_eq!(has, cfg!(any(windows, target_os = "macos")));
        assert!(!found.iter().any(|i| i.name == "photo.jpg"));
    }

    #[test]
    fn works_when_scanning_a_subfolder() {
        let root = sample();
        let projects = root.find(&["projects".into()]).unwrap();
        let found = find(
            projects,
            Path::new("/home/projects"),
            Some(Path::new("/home")),
        );
        assert!(found.iter().any(|i| i.rule == "rust-target"));
        assert!(!found.iter().any(|i| i.rule == "cargo-registry"));
    }

    #[test]
    fn wildcards() {
        assert!(segment_matches("*", "anything"));
        assert!(segment_matches("*.fcpbundle", "Trip.fcpbundle"));
        assert!(!segment_matches("*.fcpbundle", "Trip.mov"));
        assert!(segment_matches("AndroidStudio*", "AndroidStudio2025.1"));
    }
}
