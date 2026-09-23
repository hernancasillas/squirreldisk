import { useCallback, useEffect, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { message } from "@tauri-apps/plugin-dialog";
import { api, type Disk, type ScanSummary } from "./lib/api";
import { useSettings } from "./lib/settings";
import { useT } from "./lib/i18n";
import Home from "./components/Home";
import Scanning from "./components/Scanning";
import Results from "./components/Results";
import SettingsDialog from "./components/SettingsDialog";
import TitleBar from "./components/TitleBar";
import UpdateBanner from "./components/UpdateBanner";

export interface Target {
  path: string;
  disk?: Disk;
}

type Screen =
  | { kind: "home" }
  | { kind: "scanning"; target: Target }
  | { kind: "results"; target: Target; summary: ScanSummary };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  const [showSettings, setShowSettings] = useState(false);
  const { settings } = useSettings();
  const t = useT();

  const scan = useCallback((target: Target) => setScreen({ kind: "scanning", target }), []);

  const scanFailed = useCallback(
    async (error: string) => {
      setScreen({ kind: "home" });
      await message(error, { title: t("scanFailed"), kind: "error" });
    },
    [t],
  );

  const goHome = useCallback(() => {
    api.cancelScan();
    setScreen({ kind: "home" });
  }, []);

  // `squirreldisk /some/folder` starts scanning that folder right away.
  useEffect(() => {
    api.launchPath().then((path) => path && scan({ path }));
  }, [scan]);

  // Drop a folder anywhere on the window to scan it.
  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "drop" && event.payload.paths.length > 0) {
        scan({ path: event.payload.paths[0] });
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [scan]);

  useEffect(() => {
    document.documentElement.lang = settings.lang;
  }, [settings.lang]);

  return (
    <div className="app">
      <TitleBar
        onHome={screen.kind !== "home" ? goHome : undefined}
        onSettings={() => setShowSettings(true)}
      />
      <UpdateBanner />
      <main className="main">
        {screen.kind === "home" && <Home onScan={scan} />}
        {screen.kind === "scanning" && (
          <Scanning
            key={screen.target.path}
            target={screen.target}
            onCancel={goHome}
            onError={scanFailed}
            onDone={(summary) => setScreen({ kind: "results", target: screen.target, summary })}
          />
        )}
        {screen.kind === "results" && (
          <Results
            key={screen.summary.root}
            target={screen.target}
            summary={screen.summary}
            onHome={goHome}
          />
        )}
      </main>
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
  );
}
