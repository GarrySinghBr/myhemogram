import { useEffect, useRef, useState } from "react";
import { applyTheme, getStoredThemeId, THEMES, watchSystemColorScheme } from "../themes";
import { PaletteIcon } from "./icons";

export default function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(getStoredThemeId);
  const boxRef = useRef(null);

  useEffect(() => {
    applyTheme(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => watchSystemColorScheme(() => applyTheme(activeId)), [activeId]);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function pick(id) {
    applyTheme(id);
    setActiveId(id);
  }

  return (
    <div className="theme-switcher" ref={boxRef}>
      <button className="btn btn-sm" onClick={() => setOpen((v) => !v)} title="Try a different color theme">
        <PaletteIcon width={15} height={15} />
        Theme
      </button>
      {open && (
        <div className="theme-menu">
          <div className="theme-menu-title">Color theme</div>
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`theme-row ${t.id === activeId ? "active" : ""}`}
              onClick={() => pick(t.id)}
            >
              <span className="theme-swatches">
                {t.swatches.map((c, i) => (
                  <span key={i} className="theme-dot" style={{ background: c }} />
                ))}
              </span>
              <span className="theme-row-text">
                <span className="theme-row-name">{t.name}</span>
                <span className="theme-row-blurb">{t.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
