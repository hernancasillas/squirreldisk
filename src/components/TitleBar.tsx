import { isMac } from "../lib/platform";
import { useT } from "../lib/i18n";
import { GearIcon } from "./Icons";

interface Props {
  onHome?: () => void;
  onSettings: () => void;
}

export default function TitleBar({ onHome, onSettings }: Props) {
  const t = useT();
  return (
    <header className={"titlebar" + (isMac ? " titlebar-mac" : "")} data-tauri-drag-region>
      <button
        className="brand"
        onClick={onHome}
        disabled={!onHome}
        title={onHome ? t("allDisks") : undefined}
      >
        <img src="/squirrel.png" alt="" width={22} height={22} />
        <span>SquirrelDisk</span>
      </button>
      <div className="titlebar-spacer" data-tauri-drag-region />
      <button className="icon-btn" onClick={onSettings} title={t("settings")} aria-label={t("settings")}>
        <GearIcon width={18} height={18} />
      </button>
    </header>
  );
}
