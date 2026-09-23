# Changelog

## 0.5.0

### Automatic updates

- SquirrelDisk now updates itself. When a new release is out, a banner offers **Update and restart**: the update is downloaded, its signature is checked against the key built into the app, and the app restarts on the new version. This works for the macOS app, the Windows installers and the Linux AppImage. The `.deb`/`.rpm` packages and the portable Windows exe show a download link instead. You can turn off update checks in Settings.

### Cleanup suggestions

- New **Suggestions** tab. It lists well-known folders that are usually safe to clean up and shows how much space each one takes. It covers developer tools (Xcode DerivedData, device support files, archives, simulators, `node_modules`, npm/Yarn/pnpm/Bun caches, Rust `target`, Gradle, CocoaPods, Flutter, Python, Go, Homebrew, Docker, IDE caches), design and video apps (Adobe media cache, Final Cut Pro render files, Figma), browsers, chat apps, Spotify, iPhone backups, logs, temporary files and installers left in Downloads.
- Each suggestion explains what the folder is and what happens if you delete it. It is marked **Safe to delete** (it is recreated automatically) or **Review first** (it may hold things you want, or should be cleaned from its own app).
- Folders in the file list show a badge when they are a suggestion, or how much cleanable space they contain.
- Build folders are only suggested when the project confirms them: `target` needs a `Cargo.toml` next to it, `Pods` needs a `Podfile`, and so on. Nested matches are counted once.
- Detection runs locally on the scanned tree. Nothing is sent over the network.

## 0.4.0

This is the first release of the maintained fork. Most of the app was rewritten on Tauri 2 with a native Rust scanner.

### Platforms and packaging

- Native Apple Silicon support. The macOS build is now a universal binary, so it no longer needs Rosetta. The old release bundled an x86_64 `pdu` binary renamed to `aarch64`. (upstream #11, #59)
- The app is ad-hoc signed, so macOS no longer reports it as "damaged". The README documents the one-time "Open Anyway" step.
- Moved to Tauri 2, WebKitGTK 4.1 and current dependencies. This fixes the Linux builds on Ubuntu 22.04/24.04 (`libwebkit2gtk-4.0.so.37`, `libssl.so.1.1`) and the build with current Rust. (upstream #12, #28, #29, #33, #48, #49, #54)
- New Linux arm64 builds, plus `.rpm` packages.
- New portable Windows `.exe`. The installer now embeds the WebView2 bootstrapper, which helps on Windows Server. (upstream #3, #31, #32, #57)
- Every binary is built from source in GitHub Actions and ships with SHA-256 checksums and build provenance attestations. Prebuilt binaries are no longer committed to the repository. (upstream #22, #62)

### Scanning

- Replaced the `pdu` sidecar with an in-process parallel scanner. It reports live progress (files, folders, size, current path), can be cancelled, and no longer freezes at 100%. It can't miss the completion event any more. (upstream #15, #42, #46, #56, #60)
- Sizes are measured as allocated space on disk. Sparse files (Docker, OrbStack, VM images) and cloud placeholders (iCloud, Google Drive, Dropbox, OneDrive) now show their real footprint. Hard links are counted once. (upstream #24, #25, #39, #41, #63)
- On macOS, scanning "Macintosh HD" counts the data volume once through its firmlinks and skips other mounted volumes. Other mount points and virtual file systems (`/proc`, `/sys`, `/dev`, ...) are never entered on any platform. (upstream #13)
- The quick scan and the full scan are now one scan that always shows every file. Tiny items are only grouped in the chart. (upstream #52)
- Empty folders and unreadable folders are no longer shown as files. (upstream #27)
- Excluded folders: skip folders permanently, from Settings or from the context menu. (upstream #39)
- Rescan a single folder without scanning the whole disk again.

### Interface

- New treemap view next to the sunburst. (upstream #50)
- Custom tooltips show the name, size, share of the parent folder and file count. Readable labels are drawn inside the chart. (upstream #7, #61, #64)
- Better colors. Every top-level slice gets a distinct hue, neighbouring slices are shaded differently, and the file list uses the same colors as the chart. (upstream #26, #45, #61)
- New "Largest files" tab lists the biggest files anywhere below the current folder. (upstream #34)
- File counts are shown for folders. Sizes are formatted with the right precision and units, decimal or binary (configurable). (upstream #17, #40)
- A disk overview shows scanned space, space the scan couldn't see and free space. (upstream #16)
- Items are selected with checkboxes instead of drag and drop. This also fixes the window jumping while dragging on macOS. (upstream #21, #43, #67)
- Deletion moves items to the Trash or Recycle Bin by default, with an option to delete permanently. Both ask for confirmation, report failures and only accept paths from the current scan. (upstream #23)
- Uses the native window frame on Windows and Linux, and the native title bar with traffic lights on macOS. The window translucency is gone, which fixes very slow window dragging and mouse lockups on Windows 11. (upstream #19)
- Folder drag and drop, a `squirreldisk <folder>` command line, and keyboard navigation.
- Available in English, Spanish, Portuguese, French, German, Italian and Simplified Chinese. (upstream #4, #55)
- When macOS blocks folders, a banner shows how many items couldn't be read and links to Full Disk Access.

### Privacy

- Removed the third-party Headway widget and the update server on squirreldisk.com. Update checks now ask the GitHub releases API once per launch and can be turned off. (upstream #44)
