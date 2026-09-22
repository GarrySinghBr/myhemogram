// Live, switchable color themes. Every theme only redefines the "colored"
// variables (the primary-action accent, the data-line color, and the
// high/low status colors) - the neutral warm-grey chrome (page background,
// surfaces, text, borders) stays put so switching themes never changes the
// actual layout, just the accent and alert colors. "EKG Monitor" is the one
// theme that intentionally departs from that base for its own look.
//
// Applied by setting CSS custom properties directly on <html>, so every
// component that reads var(--critical) etc. (CSS, and chart code that reads
// getComputedStyle) picks it up immediately - no rebuild needed.

const THEME_VARS = [
  "--accent", "--accent-ink", "--accent-soft",
  "--data-neutral", "--data-band",
  "--critical", "--critical-soft",
  "--serious", "--serious-soft",
  "--good",
];

// Vars an "override everything" theme (like EKG Monitor) can also touch.
const BASE_VARS = [
  "--page-bg", "--surface", "--surface-2",
  "--text-primary", "--text-secondary", "--text-muted",
  "--border", "--hairline",
];

export const ALL_THEME_VARS = [...THEME_VARS, ...BASE_VARS];

export const THEMES = [
  {
    id: "space-grey",
    name: "Space Grey",
    blurb: "Neutral warm grey, monochrome buttons (default)",
    swatches: ["#222120", "#b3261e", "#3d5a80"],
    light: {
      "--accent": "#222120", "--accent-ink": "#faf9f6", "--accent-soft": "#e9e7e3",
      "--data-neutral": "#6b6863", "--data-band": "rgba(107,104,99,0.08)",
      "--critical": "#b3261e", "--critical-soft": "#f6e6e4",
      "--serious": "#3d5a80", "--serious-soft": "#e6ecf3",
      "--good": "#3f6b42",
    },
    dark: {
      "--accent": "#f3f1ec", "--accent-ink": "#1e1d1b", "--accent-soft": "#37352f",
      "--data-neutral": "#a4a199", "--data-band": "rgba(164,161,153,0.12)",
      "--critical": "#e8776d", "--critical-soft": "rgba(232,119,109,0.16)",
      "--serious": "#7fa8d9", "--serious-soft": "rgba(127,168,217,0.16)",
      "--good": "#7bab7e",
    },
  },
  {
    id: "red-straw",
    name: "Red & Straw",
    blurb: "Clean red / muted straw-yellow",
    swatches: ["#222120", "#b3261e", "#8a7a1f"],
    light: {
      "--accent": "#222120", "--accent-ink": "#faf9f6", "--accent-soft": "#e9e7e3",
      "--data-neutral": "#6b6863", "--data-band": "rgba(107,104,99,0.08)",
      "--critical": "#b3261e", "--critical-soft": "#f6e6e4",
      "--serious": "#8a7a1f", "--serious-soft": "#f2efd9",
      "--good": "#3f6b42",
    },
    dark: {
      "--accent": "#f3f1ec", "--accent-ink": "#1e1d1b", "--accent-soft": "#37352f",
      "--data-neutral": "#a4a199", "--data-band": "rgba(164,161,153,0.12)",
      "--critical": "#e8776d", "--critical-soft": "rgba(232,119,109,0.16)",
      "--serious": "#cbb84a", "--serious-soft": "rgba(203,184,74,0.16)",
      "--good": "#7bab7e",
    },
  },
  {
    id: "clinical-teal",
    name: "Clinical Teal",
    blurb: "Medical - the teal common to health-tech UIs",
    swatches: ["#0f6d66", "#b3261e", "#96751c"],
    light: {
      "--accent": "#0f6d66", "--accent-ink": "#f2fbfa", "--accent-soft": "#e0f2f0",
      "--data-neutral": "#0f6d66", "--data-band": "rgba(15,109,102,0.08)",
      "--critical": "#b3261e", "--critical-soft": "#f6e6e4",
      "--serious": "#96751c", "--serious-soft": "#f3ecd9",
      "--good": "#3f6b42",
    },
    dark: {
      "--accent": "#2dd4bf", "--accent-ink": "#063230", "--accent-soft": "rgba(45,212,191,0.16)",
      "--data-neutral": "#2dd4bf", "--data-band": "rgba(45,212,191,0.12)",
      "--critical": "#e8776d", "--critical-soft": "rgba(232,119,109,0.16)",
      "--serious": "#d9c15c", "--serious-soft": "rgba(217,193,92,0.16)",
      "--good": "#7bab7e",
    },
  },
  {
    id: "medical-blue",
    name: "Medical Blue",
    blurb: "Medical - deep clinical blue, like hospital signage",
    swatches: ["#1d4e89", "#b3261e", "#96751c"],
    light: {
      "--accent": "#1d4e89", "--accent-ink": "#f2f6fb", "--accent-soft": "#e2eaf4",
      "--data-neutral": "#1d4e89", "--data-band": "rgba(29,78,137,0.08)",
      "--critical": "#b3261e", "--critical-soft": "#f6e6e4",
      "--serious": "#96751c", "--serious-soft": "#f3ecd9",
      "--good": "#3f6b42",
    },
    dark: {
      "--accent": "#6ea3e0", "--accent-ink": "#0b1e33", "--accent-soft": "rgba(110,163,224,0.16)",
      "--data-neutral": "#6ea3e0", "--data-band": "rgba(110,163,224,0.12)",
      "--critical": "#e8776d", "--critical-soft": "rgba(232,119,109,0.16)",
      "--serious": "#d9c15c", "--serious-soft": "rgba(217,193,92,0.16)",
      "--good": "#7bab7e",
    },
  },
  {
    id: "sage-wellness",
    name: "Sage Wellness",
    blurb: "Medical - calming muted green from wellness apps",
    swatches: ["#3f6b4a", "#b3261e", "#96751c"],
    light: {
      "--accent": "#3f6b4a", "--accent-ink": "#f3f8f4", "--accent-soft": "#e5f0e8",
      "--data-neutral": "#3f6b4a", "--data-band": "rgba(63,107,74,0.08)",
      "--critical": "#b3261e", "--critical-soft": "#f6e6e4",
      "--serious": "#96751c", "--serious-soft": "#f3ecd9",
      "--good": "#3f6b42",
    },
    dark: {
      "--accent": "#86c495", "--accent-ink": "#0e2313", "--accent-soft": "rgba(134,196,149,0.16)",
      "--data-neutral": "#86c495", "--data-band": "rgba(134,196,149,0.12)",
      "--critical": "#e8776d", "--critical-soft": "rgba(232,119,109,0.16)",
      "--serious": "#d9c15c", "--serious-soft": "rgba(217,193,92,0.16)",
      "--good": "#6fbf7e",
    },
  },
  {
    id: "ekg-monitor",
    name: "EKG Monitor",
    blurb: "Medical - phosphor green on black, like a bedside monitor",
    swatches: ["#39ff8a", "#ff5c5c", "#ffd166"],
    forced: true, // ignores light/dark OS preference, always the same look
    light: {
      "--page-bg": "#05100a", "--surface": "#0a1a12", "--surface-2": "#102518",
      "--text-primary": "#d8ffea", "--text-secondary": "#7fd9a4", "--text-muted": "#4c7d63",
      "--border": "rgba(94,255,159,0.18)", "--hairline": "#163523",
      "--accent": "#39ff8a", "--accent-ink": "#04220f", "--accent-soft": "rgba(57,255,138,0.16)",
      "--data-neutral": "#39ff8a", "--data-band": "rgba(57,255,138,0.14)",
      "--critical": "#ff5c5c", "--critical-soft": "rgba(255,92,92,0.16)",
      "--serious": "#ffd166", "--serious-soft": "rgba(255,209,102,0.16)",
      "--good": "#39ff8a",
    },
    dark: null, // same as light - see forced
  },
];

const STORAGE_KEY = "myhemogram.theme";

export function getStoredThemeId() {
  try {
    return localStorage.getItem(STORAGE_KEY) || THEMES[0].id;
  } catch {
    return THEMES[0].id;
  }
}

function storeThemeId(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore (private browsing, storage disabled, etc.)
  }
}

export function applyTheme(id) {
  const theme = THEMES.find((t) => t.id === id) || THEMES[0];
  const isDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const vars = theme.forced ? theme.light : (isDark ? theme.dark : theme.light) || theme.light;

  const root = document.documentElement;
  for (const name of ALL_THEME_VARS) {
    if (vars[name] != null) {
      root.style.setProperty(name, vars[name]);
    } else {
      root.style.removeProperty(name);
    }
  }
  storeThemeId(theme.id);
  return theme;
}

export function watchSystemColorScheme(reapply) {
  const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (!mql) return () => {};
  const handler = () => reapply();
  mql.addEventListener("change", handler);
  return () => mql.removeEventListener("change", handler);
}
