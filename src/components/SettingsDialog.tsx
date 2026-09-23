import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/api";
import { LANGUAGES, useT, type Lang } from "../lib/i18n";
import { useSettings } from "../lib/settings";
import { CloseIcon } from "./Icons";

const REPO = "https://github.com/hernancasillas/squirreldisk";

export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { settings, update } = useSettings();
  const t = useT();
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion().then(setVersion);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const addExclusion = async () => {
    const dir = await open({ directory: true, multiple: false });
    if (typeof dir === "string" && !settings.exclude.includes(dir)) {
      update({ exclude: [...settings.exclude, dir] });
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={t("settings")}>
        <div className="modal-head">
          <h2>{t("settings")}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t("close")}>
            <CloseIcon />
          </button>
        </div>

        <label className="field">
          <span>{t("language")}</span>
          <select value={settings.lang} onChange={(e) => update({ lang: e.target.value as Lang })}>
            {Object.entries(LANGUAGES).map(([code, { label }]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{t("units")}</span>
          <select value={settings.unitBase} onChange={(e) => update({ unitBase: Number(e.target.value) as 1000 | 1024 })}>
            <option value={1000}>{t("unitsDecimal")}</option>
            <option value={1024}>{t("unitsBinary")}</option>
          </select>
        </label>

        <div className="field field-block">
          <span>{t("exclusions")}</span>
          <p className="muted small">{t("exclusionsHint")}</p>
          <div className="exclusions">
            {settings.exclude.length === 0 && <div className="muted small">{t("noExclusions")}</div>}
            {settings.exclude.map((p) => (
              <div key={p} className="exclusion">
                <span className="mono small">{p}</span>
                <button
                  className="link small"
                  onClick={() => update({ exclude: settings.exclude.filter((x) => x !== p) })}
                >
                  {t("remove")}
                </button>
              </div>
            ))}
          </div>
          <button className="btn btn-small" onClick={addExclusion}>
            {t("addFolder")}
          </button>
        </div>

        <label className="field field-check">
          <input
            type="checkbox"
            checked={settings.checkUpdates}
            onChange={(e) => update({ checkUpdates: e.target.checked })}
          />
          <span>{t("checkUpdates")}</span>
        </label>

        <div className="modal-foot muted small">
          <span>SquirrelDisk {version} · AGPL-3.0</span>
          <span>
            <button className="link" onClick={() => api.openUrl(REPO)}>
              {t("sourceCode")}
            </button>
            {" · "}
            <button className="link" onClick={() => api.openUrl(REPO + "/issues")}>
              {t("reportIssue")}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
