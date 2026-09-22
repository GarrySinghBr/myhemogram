// A small set of hand-drawn, single-color line icons (stroke = currentColor).
// No gradients, no filled glyphs, no icon font/library - kept deliberately
// plain so they sit quietly in a mostly-monochrome UI.

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function LogoMark({ size = 18 }) {
  return (
    <svg {...base} width={size} height={size} aria-hidden="true">
      <path d="M2 13h4l1.8-5 3.2 10 3-13 2.4 8H22" />
    </svg>
  );
}

export function UploadIcon(props) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M12 15V4" />
      <path d="M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

export function CompareIcon(props) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M8 3v18" />
      <path d="M16 3v18" />
      <path d="M4 8h4" />
      <path d="M16 16h4" />
    </svg>
  );
}

export function TrendIcon(props) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M4 16l5-6 4 3 6-8" />
      <path d="M4 20h16" />
    </svg>
  );
}

export function PaletteIcon(props) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M12 3a9 8 0 1 0 0 16c1 0 1.5-.6 1.5-1.4 0-.4-.15-.7-.4-1-.25-.3-.4-.6-.4-1 0-.8.7-1.4 1.5-1.4H16a4 4 0 0 0 4-4c0-4-3.6-7.2-8-7.2Z" />
      <circle cx="7.5" cy="10.5" r=".75" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7.2" r=".75" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="7.5" r=".75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function DocumentIcon(props) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
    </svg>
  );
}
