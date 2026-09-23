import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api, type Disk } from "../lib/api";
import { formatBytes } from "../lib/format";
import { useSettings } from "../lib/settings";
import { useT } from "../lib/i18n";
import type { Target } from "../App";
import { DiskIcon, HomeIcon, PlusFolderIcon, UsbIcon } from "./Icons";

function usageLevel(ratio: number) {
  if (ratio >= 0.9) return "danger";
  if (ratio >= 0.75) return "warn";
  return "ok";
}

export default function Home({ onScan }: { onScan: (t: Target) => void }) {
  const [disks, setDisks] = useState<Disk[] | null>(null);
  const [home, setHome] = useState<string | null>(null);
  const { settings } = useSettings();
  const t = useT();
  const fmt = (n: number) => formatBytes(n, settings.unitBase);

  useEffect(() => {
    let alive = true;
    const refresh = () =>
      api
        .listDisks()
        .then((d) => alive && setDisks(d))
        .catch(() => alive && setDisks([]));
    refresh();
    api.homeDir().then((h) => alive && setHome(h));
    // Pick up drives that get plugged in or ejected.
    const id = setInterval(refresh, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const pickFolder = async () => {
    const dir = await open({ directory: true, multiple: false });
    if (typeof dir === "string") onScan({ path: dir });
  };

  return (
    <div className="home">
      <div className="home-hero">
        <h1>{t("tagline")}</h1>
      </div>

      <section>
        <h2 className="section-title">{t("disks")}</h2>
        <div className="disk-grid">
          {disks === null && <div className="muted">{t("loading")}</div>}
          {disks?.length === 0 && <div className="muted">{t("noDisks")}</div>}
          {disks?.map((disk) => {
            const used = disk.totalSpace - disk.availableSpace;
            const ratio = disk.totalSpace > 0 ? used / disk.totalSpace : 0;
            const Icon = disk.isRemovable ? UsbIcon : DiskIcon;
            return (
              <button key={disk.mountPoint} className="card disk-card" onClick={() => onScan({ path: disk.mountPoint, disk })}>
                <div className="disk-card-head">
                  <Icon width={28} height={28} className="disk-icon" />
                  <div className="disk-card-title">
                    <div className="disk-name">{disk.name || disk.mountPoint}</div>
                    <div className="muted small">
                      {disk.mountPoint}
                      {disk.fileSystem && ` · ${disk.fileSystem}`}
                      {disk.isRemovable && ` · ${t("removable")}`}
                    </div>
                  </div>
                  <div className="disk-percent">{Math.round(ratio * 100)}%</div>
                </div>
                <div className="meter">
                  <div className={`meter-fill ${usageLevel(ratio)}`} style={{ width: `${ratio * 100}%` }} />
                </div>
                <div className="disk-card-foot small">
                  <span>{t("usedOf", { used: fmt(used), total: fmt(disk.totalSpace) })}</span>
                  <span className="muted">{t("free", { size: fmt(disk.availableSpace) })}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="section-title">{t("locations")}</h2>
        <div className="location-grid">
          {home && (
            <button className="card location-card" onClick={() => onScan({ path: home })}>
              <HomeIcon width={22} height={22} />
              <div>
                <div>{t("homeFolder")}</div>
                <div className="muted small">{home}</div>
              </div>
            </button>
          )}
          <button className="card location-card" onClick={pickFolder}>
            <PlusFolderIcon width={22} height={22} />
            <div>
              <div>{t("scanFolder")}</div>
              <div className="muted small">{t("scanFolderHint")}</div>
            </div>
          </button>
        </div>
      </section>

      <p className="muted small home-tip">{t("dropHint")}</p>
    </div>
  );
}
