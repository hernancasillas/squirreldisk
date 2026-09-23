import { useEffect, useRef, useState } from "react";
import { api, onScanDone, onScanProgress, type ScanProgress, type ScanSummary } from "../lib/api";
import { formatBytes, formatDuration, formatNumber } from "../lib/format";
import { useSettings } from "../lib/settings";
import { useT } from "../lib/i18n";
import type { Target } from "../App";

interface Props {
  target: Target;
  onCancel: () => void;
  onDone: (summary: ScanSummary) => void;
  onError: (message: string) => void;
}

export default function Scanning({ target, onCancel, onDone, onError }: Props) {
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const { settings } = useSettings();
  const t = useT();

  const callbacks = useRef({ onDone, onError });
  callbacks.current = { onDone, onError };
  const exclude = settings.exclude;

  useEffect(() => {
    let active = true;
    const unProgress = onScanProgress((p) => active && setProgress(p));
    const unDone = onScanDone((done) => {
      if (active && !done.cancelled && !done.partial && done.summary) {
        callbacks.current.onDone(done.summary);
      }
    });
    // Start only once both listeners are registered, so even a scan that
    // finishes instantly can't slip past us.
    Promise.all([unProgress, unDone])
      .then(() => {
        if (active) return api.startScan(target.path, exclude);
      })
      .catch((e) => active && callbacks.current.onError(String(e)));
    return () => {
      active = false;
      unProgress.then((f) => f());
      unDone.then((f) => f());
    };
  }, [target.path, exclude]);

  // For whole disks the used space gives a good (if not exact) sense of progress.
  const used = target.disk ? target.disk.totalSpace - target.disk.availableSpace : 0;
  const ratio = used > 0 && progress ? Math.min(progress.bytes / used, 0.99) : null;
  const locale = settings.lang;

  return (
    <div className="scanning">
      <div className="scan-orb" aria-hidden>
        <div className="scan-orb-ring" />
        <img src="/squirrel.png" alt="" width={72} height={72} />
      </div>
      <h2 className="scan-title">
        {t("scanning")} <span className="mono">{target.path}</span>
      </h2>

      <div className="scan-stats">
        <div className="stat">
          <div className="stat-value">{formatBytes(progress?.bytes ?? 0, settings.unitBase)}</div>
          <div className="stat-label">{t("found")}</div>
        </div>
        <div className="stat">
          <div className="stat-value">{formatNumber(progress?.files ?? 0, locale)}</div>
          <div className="stat-label">{t("files")}</div>
        </div>
        <div className="stat">
          <div className="stat-value">{formatNumber(progress?.dirs ?? 0, locale)}</div>
          <div className="stat-label">{t("folders")}</div>
        </div>
        <div className="stat">
          <div className="stat-value">{formatDuration(progress?.elapsedMs ?? 0)}</div>
          <div className="stat-label">{t("elapsed")}</div>
        </div>
      </div>

      <div className="progress">
        {ratio === null ? (
          <div className="progress-indeterminate" />
        ) : (
          <div className="progress-fill" style={{ width: `${ratio * 100}%` }} />
        )}
      </div>
      <div className="scan-current mono small muted" title={progress?.current}>
        {progress?.current || " "}
      </div>

      <button className="btn" onClick={onCancel}>
        {t("cancel")}
      </button>
    </div>
  );
}
