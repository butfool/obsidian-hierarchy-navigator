/**
 * Inline SVG icon strings (Heroicons-style outline).
 * Using SVGs (not emoji) keeps the design language consistent
 * across platforms — emoji glyphs vary wildly by OS.
 */

const NS = "http://www.w3.org/2000/svg";

const wrap = (paths: string): SVGElement => {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.innerHTML = paths;
  return svg;
};

export const Icons = {
  /** Folder icon — outline, stroked. */
  folder: (): SVGElement => wrap(`
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
  `),

  /** File icon — outline, stroked. The generic fallback for any type
   *  that has no more specific glyph. */
  file: (): SVGElement => wrap(`
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>
    <path d="M14 3v5h5"/>
  `),

  /** Markdown note — a page with text lines. */
  note: (): SVGElement => wrap(`
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>
    <path d="M14 3v5h5"/>
    <path d="M8.5 12.8h7M8.5 16.3h4.5"/>
  `),

  /** PDF — a page with a solid corner fold and a footer bar, so it reads
   *  as a "fixed document" rather than an editable note. */
  pdf: (): SVGElement => wrap(`
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>
    <path d="M14 3v5h5" fill="currentColor" stroke-linejoin="round"/>
    <path d="M8.5 16.5h7"/>
  `),

  /** Canvas — two connected nodes. */
  canvas: (): SVGElement => wrap(`
    <rect x="3" y="4" width="7" height="5.5" rx="1.5"/>
    <rect x="14" y="14.5" width="7" height="5.5" rx="1.5"/>
    <path d="M10 6.75h4.25a2.25 2.25 0 0 1 2.25 2.25v5.5"/>
  `),

  /** Base — a database / table. */
  base: (): SVGElement => wrap(`
    <ellipse cx="12" cy="6.5" rx="7" ry="3"/>
    <path d="M5 6.5v11c0 1.66 3.13 3 7 3s7-1.34 7-3v-11"/>
    <path d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3"/>
  `),

  /** Image / photo. */
  image: (): SVGElement => wrap(`
    <rect x="3.5" y="5" width="17" height="14" rx="2.5"/>
    <circle cx="8.8" cy="10.2" r="1.6"/>
    <path d="M3.5 18.4l5.1-5.3a2 2 0 0 1 2.9 0l4.6 4.9"/>
    <path d="M14.2 15.2l1.4-1.4a2 2 0 0 1 2.9 0l1.5 1.6"/>
  `),

  /** Audio — a music note. */
  audio: (): SVGElement => wrap(`
    <path d="M9.5 17V6.2l8-1.5V15"/>
    <circle cx="7" cy="17.2" r="2.4"/>
    <circle cx="15" cy="15" r="2.4"/>
  `),

  /** Video — a play mark in a frame. */
  video: (): SVGElement => wrap(`
    <rect x="3" y="5" width="18" height="14" rx="2.5"/>
    <path d="M10.4 9.3l4.8 2.7-4.8 2.7z" fill="currentColor" stroke-linejoin="round"/>
  `),

  /** Code / markup — HTML, CSS, JS, JSON, and friends. */
  code: (): SVGElement => wrap(`
    <path d="M9 7.5 5 12l4 4.5"/>
    <path d="M15 7.5 19 12l-4 4.5"/>
    <path d="M13.2 5.5 10.8 18.5"/>
  `),

  /** Folder Note icon — a folder with a small document mark. */
  folderNote: (): SVGElement => wrap(`
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <path d="M9 11h6M9 14h4"/>
  `),

  /** Home icon — the vault homepage (Homepage plugin). */
  home: (): SVGElement => wrap(`
    <path d="M3 10.7 12 3.6l9 7.1"/>
    <path d="M5.5 9.7V19a1.5 1.5 0 0 0 1.5 1.5h10A1.5 1.5 0 0 0 18.5 19V9.7"/>
    <path d="M9.5 20.5v-4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v4.8"/>
  `),

  /** Chevron-right — used as an affordance on hover. */
  chevronRight: (): SVGElement => wrap(`
    <path d="M9 6l6 6-6 6"/>
  `),

  /** Chevron-up — Parent section icon. */
  chevronUp: (): SVGElement => wrap(`
    <path d="M6 15l6-6 6 6"/>
  `),

  /** Chevron-down — Children section icon. */
  chevronDown: (): SVGElement => wrap(`
    <path d="M6 9l6 6 6-6"/>
  `),

  /** Compass / hierarchy root icon — used for the block header. */
  compass: (): SVGElement => wrap(`
    <circle cx="12" cy="12" r="9"/>
    <path d="M15.5 8.5l-2.4 4.8-4.8 2.4 2.4-4.8z"/>
  `),

  /** Hash (#) — for tag-like badges. */
  hash: (): SVGElement => wrap(`
    <path d="M4 9h16M4 15h16M10 4l-2 16M16 4l-2 16"/>
  `),

  /** Grid — the body index's own marker (it is a collection view, not a row). */
  grid: (): SVGElement => wrap(`
    <rect x="3.5" y="3.5" width="7" height="7" rx="2"/>
    <rect x="13.5" y="3.5" width="7" height="7" rx="2"/>
    <rect x="3.5" y="13.5" width="7" height="7" rx="2"/>
    <rect x="13.5" y="13.5" width="7" height="7" rx="2"/>
  `),
};

/* ────────────────────────────────────────────────
   File-type icons — one glyph per family of file,
   so a row of pills can be scanned without reading
   every label.
   ──────────────────────────────────────────────── */

/**
 * Coarse file families. Deliberately few: a 12px glyph cannot carry more
 * detail than this, and the point is to tell "a note" from "a canvas",
 * "an image" from "a PDF" at a glance.
 */
export type FileTypeKey =
  | "note"
  | "pdf"
  | "canvas"
  | "base"
  | "image"
  | "audio"
  | "video"
  | "code"
  | "file";

/** Extension → family. Anything not listed falls back to `file`. */
const EXTENSION_TYPES: Record<string, FileTypeKey> = {
  md: "note",
  markdown: "note",
  mdx: "note",

  canvas: "canvas",
  base: "base",
  pdf: "pdf",

  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  bmp: "image",
  svg: "image",
  webp: "image",
  avif: "image",
  ico: "image",
  tif: "image",
  tiff: "image",

  mp3: "audio",
  wav: "audio",
  m4a: "audio",
  ogg: "audio",
  oga: "audio",
  opus: "audio",
  flac: "audio",
  aac: "audio",
  "3gp": "audio",

  mp4: "video",
  webm: "video",
  ogv: "video",
  mov: "video",
  mkv: "video",
  avi: "video",

  html: "code",
  htm: "code",
  xhtml: "code",
  css: "code",
  scss: "code",
  sass: "code",
  less: "code",
  js: "code",
  mjs: "code",
  cjs: "code",
  jsx: "code",
  ts: "code",
  tsx: "code",
  json: "code",
  jsonc: "code",
  xml: "code",
  yaml: "code",
  yml: "code",
  toml: "code",
  ini: "code",
  py: "code",
  rb: "code",
  go: "code",
  rs: "code",
  java: "code",
  kt: "code",
  php: "code",
  c: "code",
  h: "code",
  cpp: "code",
  hpp: "code",
  cs: "code",
  sh: "code",
  bash: "code",
  zsh: "code",
  fish: "code",
  sql: "code",
  tex: "code",
};

/** The glyph for a family, ready to drop into a pill. */
const TYPE_ICONS: Record<FileTypeKey, () => SVGElement> = {
  note: Icons.note,
  pdf: Icons.pdf,
  canvas: Icons.canvas,
  base: Icons.base,
  image: Icons.image,
  audio: Icons.audio,
  video: Icons.video,
  code: Icons.code,
  file: Icons.file,
};

/** Map a file extension (with or without a leading dot) to its family. */
export function fileTypeKey(extension: string): FileTypeKey {
  const ext = extension.replace(/^\./, "").toLowerCase();
  return EXTENSION_TYPES[ext] ?? "file";
}

/** Icon for a file extension. */
export function fileTypeIcon(extension: string): SVGElement {
  return TYPE_ICONS[fileTypeKey(extension)]();
}

/**
 * The family's CSS modifier — `hn-type-note`, `hn-type-pdf`, … — so a
 * theme can tint or restyle one family without touching the others.
 */
export function fileTypeClass(extension: string): string {
  return `hn-type-${fileTypeKey(extension)}`;
}
