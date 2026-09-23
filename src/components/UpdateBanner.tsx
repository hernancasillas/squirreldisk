import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { api } from "../lib/api";
import { compareVersions } from "../lib/format";
import { useSettings } from "../lib/settings";
import { useT } from "../lib/i18n";
import { CloseIcon } from "./Icons";

const RELEASES_API = "https://api.github.com/repos/hernancasillas/squirreldisk/releases/latest";

/** Asks GitHub (once per launch, opt-out in Settings) whether a newer release exists. */
export default function UpdateBanner() {
  const { settings } = useSettings();
  const t = useT();
  const [update, setUpdate] = useState<{ version: string; url: string } | null>(null);

  useEffect(() => {
    if (!settings.checkUpdates) return;
    let cancelled = false;
    (async () => {
      try {
        const [current, res] = await Promise.all([
          getVersion(),
          fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json" } }),
        ]);
        if (!res.ok) return;
        const latest = await res.json();
        if (!cancelled && latest.tag_name && compareVersions(latest.tag_name, current) > 0) {
          setUpdate({ version: String(latest.tag_name).replace(/^v/, ""), url: latest.html_url });
        }
      } catch {
        // Offline or rate limited: nothing to show.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settings.checkUpdates]);

  if (!update) return null;
  return (
    <div className="banner">
      <span>{t("updateAvailable", { v: update.version })}</span>
      <button className="btn btn-small btn-primary" onClick={() => api.openUrl(update.url)}>
        {t("download")}
      </button>
      <button className="icon-btn" onClick={() => setUpdate(null)} aria-label={t("close")}>
        <CloseIcon />
      </button>
    </div>
  );
}
