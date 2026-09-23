import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type MenuItem = { label: string; action: () => void } | { separator: true };

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Keep the menu inside the window.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      x: Math.min(x, window.innerWidth - width - 8),
      y: Math.min(y, window.innerHeight - height - 8),
    });
  }, [x, y]);

  useEffect(() => {
    const close = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", close);
    window.addEventListener("blur", onClose);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const visible = items.filter((item, i) => !("separator" in item) || (i > 0 && i < items.length - 1));

  return (
    <div ref={ref} className="menu" style={{ left: pos.x, top: pos.y }} role="menu">
      {visible.map((item, i) =>
        "separator" in item ? (
          <div key={i} className="menu-sep" />
        ) : (
          <button
            key={i}
            role="menuitem"
            className="menu-item"
            onClick={() => {
              onClose();
              item.action();
            }}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
