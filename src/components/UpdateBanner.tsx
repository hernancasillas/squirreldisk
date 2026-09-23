import { useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { api } from "../lib/api";
import { compareVersions } from "../lib/format";
import { useSettings } from "../lib/settings";
import { useT } from "../lib/i18n";
import { CloseIcon } from "./Icons";

const REPO = "https://github.com/hernancasillas/squirreldisk";
const RELEASES_API = "https://api.github.com/repos/hernancasillas/squirreldisk/releases/latest";

interface Available {
  version: string;
  /** Present when the app can update itself; otherwise we link to the release. */
  update: Update | null;
  url: string;
}

/** Looks for a new release once per launch (can be turned off in Settings). */
async function findUpdate(): Promise<Available | null> {
  try {
    // Signed in-app update (macOS app, Windows installer, AppImage).
    const update = await check();
    if (update) return { version: update.version, update, url: `${REPO}/releases/tag/v${update.version}` };
    return null;
  } catch {
    // The updater isn't available for this install (dev build, .deb/.rpm,
    // portable exe...): fall back to asking GitHub and linking the download.
  }
  const [current, res] = await Promise.all([
    getVersion(),
    fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json" } }),
  ]);
  if (!res.ok) return null;
  const latest = await res.json();
  if (!latest.tag_name || compareVersions(latest.tag_name, current) <= 0) return null;
  return { version: String(latest.tag_name).replace(/^v/, ""), update: null, url: latest.html_url };
}

export default function UpdateBanner() {
  const { settings } = useSettings();
  const t = useT();
  const [available, setAvailable] = useState<Available | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const bytes = useRef({ total: 0, done: 0 });

  useEffect(() => {
    if (!settings.checkUpdates) return;
    let cancelled = false;
    findUpdate()
      .then((a) => !cancelled && setAvailable(a))
      .catch(() => {
        // Offline or rate limited: nothing to show.
      });
    return () => {
      cancelled = true;
    };
  }, [settings.checkUpdates]);

  if (!available) return null;

  const install = async () => {
    if (!available.update) return api.openUrl(available.url);
    setProgress(0);
    setFailed(false);
    try {
      await available.update.downloadAndInstall((event) => {
        if (event.event === "Started") bytes.current = { total: event.data.contentLength ?? 0, done: 0 };
        if (event.event === "Progress") {
          bytes.current.done += event.data.chunkLength;
          const { total, done } = bytes.current;
          setProgress(total > 0 ? Math.min(99, Math.round((done / total) * 100)) : 0);
        }
      });
      await relaunch();
    } catch {
      setProgress(null);
      setFailed(true);
    }
  };

  return (
    <div className="banner">
      {progress !== null ? (
        <span>{t("updating", { p: progress })}</span>
      ) : (
        <>
          <span>{failed ? t("updateFailed") : t("updateAvailable", { v: available.version })}</span>
          {failed ? (
            <button className="btn btn-small btn-primary" onClick={() => api.openUrl(available.url)}>
              {t("download")}
            </button>
          ) : (
            <button className="btn btn-small btn-primary" onClick={install}>
              {available.update ? t("updateNow") : t("download")}
            </button>
          )}
          <button className="icon-btn" onClick={() => setAvailable(null)} aria-label={t("close")}>
            <CloseIcon />
          </button>
        </>
      )}
    </div>
  );
}
