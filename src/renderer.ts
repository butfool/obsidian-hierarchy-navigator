import { TFile, TFolder, TAbstractFile } from "obsidian";
import type {
  AnyApp,
  FolderNoteAPI,
  HomepagePluginAPI,
  HierarchyNavigatorSettings,
} from "./types";
import type HierarchyNavigator from "./main";
import { Icons, fileTypeIcon, fileTypeClass } from "./icons";
import { getStrings, type Strings } from "./i18n";

const ROOT = "/";
const FOLDER_NOTE_SUFFIX = ".md";

/** Exported so `main.ts` can query / remove our nodes by selector. */
export const BLOCK_CLASS = "hn-root";

/** Duration of the fold/unfold animation — keep in sync with styles.css. */
const FOLD_MS = 180;

/** Duration of the "+N" dropdown open/close animation — keep in sync with styles.css. */
const MENU_MS = 140;
/** The dropdown opens shortly after the pointer arrives... */
const MENU_HOVER_OPEN_MS = 60;
/** ...and slips away once it leaves. The CSS bridge already spans the gap
 * between chip and panel; this grace only absorbs odd paths across the edge. */
const MENU_HOVER_CLOSE_MS = 240;

/* ────────────────────────────────────────────────
   Detection helpers
   ──────────────────────────────────────────────── */

function isFolderNote(
  plugin: HierarchyNavigator,
  file: TFile,
): boolean {
  const api = (plugin.app as AnyApp).plugins?.plugins?.["folder-note"] as
    | FolderNoteAPI
    | undefined;
  const folderSet = api?.fn?.folderMFiles;
  if (folderSet && typeof folderSet.has === "function") {
    return folderSet.has(file.path);
  }
  const parent = file.parent;
  if (!parent) return false;
  return parent.name === file.basename;
}

function isHiddenByFrontmatter(
  plugin: HierarchyNavigator,
  file: TFile,
): boolean {
  const cache = plugin.app.metadataCache.getFileCache(file);
  if (!cache?.frontmatter) return false;
  const fm = cache.frontmatter;
  if (fm["hierarchy-nav"] === "hide") return true;
  if (fm["hierarchy_nav"] === "hide") return true;
  if (fm["hn-hide"] === true || fm["hn-hide"] === "true") return true;
  return false;
}

function findFolderNoteFile(
  plugin: HierarchyNavigator,
  folder: TFolder,
): TFile | null {
  const candidate = `${folder.path}/${folder.name}${FOLDER_NOTE_SUFFIX}`;
  const af: TAbstractFile | null =
    plugin.app.vault.getAbstractFileByPath(candidate);
  return af instanceof TFile ? af : null;
}

/** Fallback used only if the internal view registry is unavailable. */
const FALLBACK_SUPPORTED_EXTENSIONS = new Set([
  "md", "canvas", "base", "pdf",
  "png", "jpg", "jpeg", "gif", "bmp", "svg", "webp", "avif",
  "mp3", "wav", "m4a", "ogg", "3gp", "flac",
  "mp4", "webm", "ogv", "mov", "mkv",
]);

/**
 * Only list files Obsidian can actually open. The view registry holds the
 * live extension → view-type map that Obsidian itself consults when opening
 * a file, so unsupported formats (scripts, .DS_Store, …) drop out.
 */
function isSupportedByObsidian(
  plugin: HierarchyNavigator,
  file: TFile,
): boolean {
  const registry = (plugin.app as unknown as {
    viewRegistry?: {
      getTypeByExtension?: (extension: string) => string | null | undefined;
    };
  }).viewRegistry;
  const getTypeByExtension = registry?.getTypeByExtension;
  if (typeof getTypeByExtension === "function") {
    return Boolean(getTypeByExtension.call(registry, file.extension.toLowerCase()));
  }
  return FALLBACK_SUPPORTED_EXTENSIONS.has(file.extension.toLowerCase());
}

function logicalFolderForFile(
  plugin: HierarchyNavigator,
  file: TFile,
): TFolder | null {
  if (!isFolderNote(plugin, file)) return null;
  return file.parent instanceof TFolder ? file.parent : null;
}

/**
 * The homepage note configured in the community "Homepage" plugin
 * (novov). Read from the plugin's runtime settings; returns null when
 * the plugin is absent or the entry isn't a plain file.
 */
function resolveHomepageFile(plugin: HierarchyNavigator): TFile | null {
  try {
    const instance = (plugin.app as AnyApp).plugins?.plugins?.["homepage"] as
      | HomepagePluginAPI
      | undefined;
    const pages = instance?.settings?.homepages;
    if (!pages) return null;
    const entry = pages["Main Homepage"] ?? Object.values(pages)[0];
    if (!entry || entry.kind !== "File" || !entry.value) return null;
    const dest = plugin.app.metadataCache.getFirstLinkpathDest(entry.value, "");
    if (dest instanceof TFile) return dest;
    const direct = plugin.app.vault.getAbstractFileByPath(
      entry.value.endsWith(".md") ? entry.value : `${entry.value}.md`,
    );
    return direct instanceof TFile ? direct : null;
  } catch {
    return null;
  }
}

function collectLogicalChildren(
  plugin: HierarchyNavigator,
  folder: TFolder,
  out: Array<TFile | TFolder>,
): void {
  for (const child of folder.children ?? []) {
    if (!(child instanceof TFile || child instanceof TFolder)) continue;
    // A folder's own note represents the folder itself; it is never
    // one of that folder's children.
    if (child instanceof TFile && isFolderNoteFile(plugin, child, folder)) continue;
    if (child instanceof TFile && !isSupportedByObsidian(plugin, child)) continue;
    out.push(child);
  }
}

/**
 * Row order for a section: folders first, then files; natural name order
 * inside each group. Folder Notes sort as the folder they stand for, and
 * the vault's own ordering is never trusted — it interleaves folders and
 * files by name, which buries the folders you navigate by.
 */
function compareEntries(a: Entry, b: Entry): number {
  const aIsFolder = a instanceof TFolder;
  const bIsFolder = b instanceof TFolder;
  if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/* ────────────────────────────────────────────────
   Tiny DOM helpers — never use `<ul>` or `<li>`.
   That way we don't trip over user CSS, theme
   rules, or `.internal-link` ul lists.
   ──────────────────────────────────────────────── */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: {
    cls?: string;
    text?: string;
    attr?: Record<string, string>;
    children?: (Element | string)[];
  } = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (opts.cls) node.className = opts.cls;
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.attr) {
    for (const [k, v] of Object.entries(opts.attr)) node.setAttribute(k, v);
  }
  if (opts.children) {
    for (const c of opts.children) {
      if (typeof c === "string") node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    }
  }
  return node;
}

function openTarget(
  plugin: HierarchyNavigator,
  target: TFile | TFolder,
): void {
  if (target instanceof TFile) {
    plugin.app.workspace.openLinkText(target.path, "", false);
    return;
  }
  const explorer = plugin.app.workspace.getLeavesOfType("file-explorer")[0];
  const view = (explorer as { view?: { revealInFolder?: (t: unknown) => void } } | undefined)?.view;
  view?.revealInFolder?.(target);
}

/* ────────────────────────────────────────────────
   Single-line inline layout
   ──────────────────────────────────────────────── */

type Entry = TFile | TFolder;

interface Segment {
  /** Single-line label for the column header — e.g. "Parent". */
  label: string;
  /** SVG icon placed to the LEFT of the label. */
  icon: SVGElement;
  /**
   * Items to render. Never empty: a section without items is not a section,
   * and the caller drops the row entirely rather than printing a placeholder
   * — `buildSegment` relies on this.
   */
  items: Array<{
    /** Resolve where to jump when this item is clicked. */
    target: TFile | TFolder;
    /** Display text. */
    name: string;
    /** `file` / `dir`. Used to pick an inline icon next to the name. */
    kind: "file" | "dir" | "folder-note" | "home";
    /**
     * File extension driving the type icon — files only. Absent for
     * folders, folder notes and the homepage, which have fixed glyphs.
     */
    ext?: string;
  }>;
}

function makeItem(plugin: HierarchyNavigator, entry: Entry) {
  if (entry instanceof TFolder) {
    // A folder navigates as itself, or as the Folder Note standing in
    // for it — which is also what decides its glyph.
    const note = findFolderNoteFile(plugin, entry);
    return {
      target: note ?? entry,
      name: entry.name,
      kind: note ? ("folder-note" as const) : ("dir" as const),
    };
  }
  // Plain file: the extension decides which glyph the pill wears.
  return {
    target: entry,
    name: entry.basename,
    kind: "file" as const,
    ext: entry.extension,
  };
}

function isFolderNoteFile(
  plugin: HierarchyNavigator,
  entry: Entry,
  folder: TFolder,
): boolean {
  return entry instanceof TFile && entry.path === findFolderNoteFile(plugin, folder)?.path;
}

function makePill(
  plugin: HierarchyNavigator,
  it: Segment["items"][number],
): HTMLElement {
  const typeMod = it.kind === "file" && it.ext !== undefined
    ? ` ${fileTypeClass(it.ext)}`
    : "";
  const pill = el("a", {
    cls: `hn-pill hn-kind-${it.kind}${typeMod}`,
    attr: { "data-href": it.target.path },
  });
  pill.appendChild(
    it.kind === "folder-note"
      ? Icons.folderNote()
      : it.kind === "home"
        ? Icons.home()
        : it.kind === "dir"
          ? Icons.folder()
          : it.ext !== undefined
            ? fileTypeIcon(it.ext)
            : Icons.file(),
  );
  pill.appendChild(el("span", { cls: "hn-pill-name", text: it.name }));
  pill.addEventListener("click", (ev) => {
    ev.preventDefault();
    openTarget(plugin, it.target);
  });
  return pill;
}

/**
 * The "+N" overflow chip: a peeking list of everything that did not fit on
 * the row.
 *
 * It is a native `<details>` so the toggle stays keyboard-reachable, but the
 * open/close *feel* is driven from here: native toggling drops the panel the
 * instant `open` is removed, which would make the exit animation invisible,
 * so `open` is held until the exit transition has run. On top of the click
 * toggle it dismisses when the pointer leaves, when another element is
 * pressed, and on Escape — a peek panel should not linger.
 */
interface OverflowPanel {
  /** The `<details>` element — chip plus panel. */
  root: HTMLElement;
  /** Container holding the pills that did not fit. */
  menu: HTMLElement;
  /** Hand the panel exactly these pills (hides it when there are none). */
  setPills(pills: HTMLElement[]): void;
  /** Dismiss it if it is open. */
  close(): void;
}

function makeOverflowMenu(plugin: HierarchyNavigator): OverflowPanel {
  const more = el("details", { cls: "hn-more" });
  const chip = el("summary", {
    cls: "hn-more-chip",
    text: "+0",
  });
  more.appendChild(chip);
  const menu = el("div", { cls: "hn-more-menu" });
  more.appendChild(menu);

  let openTimer = 0;
  let closeTimer = 0;
  let hideTimer = 0;
  let pointerInside = false;
  /** Set when the pointer clicks the chip shut, so hovering can't undo it. */
  let dismissedByClick = false;

  const isOpen = () => more.classList.contains("hn-open");
  const open = () => {
    if (isOpen()) return;
    window.clearTimeout(hideTimer);
    window.clearTimeout(closeTimer);
    more.open = true;
    // Flush the freshly shown panel so the transition has a "from" state.
    void menu.offsetHeight;
    // Hand the bridge (styles.css) the panel's real width so the pointer can
    // travel from the chip into the panel without crossing dead space.
    // `offsetWidth` is the layout width — at this instant the panel still
    // carries its 0.97 entry scale, which a bounding rect would report.
    more.style.setProperty("--hn-bridge-w", `${menu.offsetWidth}px`);
    more.classList.add("hn-open");
  };
  const close = () => {
    if (!isOpen()) return;
    window.clearTimeout(openTimer);
    window.clearTimeout(closeTimer);
    more.classList.remove("hn-open");
    hideTimer = window.setTimeout(() => {
      more.open = false;
    }, MENU_MS);
  };

  chip.addEventListener("click", (ev) => {
    ev.preventDefault();
    if (isOpen()) {
      // Only worth guarding while the pointer is actually resting on the
      // chip — a keyboard close should not swallow the next hover.
      dismissedByClick = pointerInside;
      close();
    } else {
      dismissedByClick = false;
      open();
    }
  });

  more.addEventListener("mouseenter", () => {
    pointerInside = true;
    window.clearTimeout(openTimer);
    window.clearTimeout(closeTimer);
    if (dismissedByClick || isOpen()) return;
    openTimer = window.setTimeout(open, MENU_HOVER_OPEN_MS);
  });

  more.addEventListener("mouseleave", () => {
    pointerInside = false;
    dismissedByClick = false;
    window.clearTimeout(openTimer);
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(close, MENU_HOVER_CLOSE_MS);
  });

  more.addEventListener("keydown", (ev: KeyboardEvent) => {
    if (ev.key !== "Escape" || !isOpen()) return;
    ev.preventDefault();
    ev.stopPropagation();
    close();
    chip.focus();
  });

  // Covers keyboard-opened panels (no pointer ever left them) and clicks
  // elsewhere on the note. Self-detaches once the block is discarded.
  const onPointerDown = (ev: PointerEvent) => {
    if (!more.isConnected) {
      document.removeEventListener("pointerdown", onPointerDown, true);
      return;
    }
    if (isOpen() && !more.contains(ev.target as Node)) close();
  };
  document.addEventListener("pointerdown", onPointerDown, true);

  return {
    root: more,
    menu,
    close,
    setPills(pills) {
      pills.forEach((pill, i) => {
        // Index drives the cascade in styles.css; cap it so a long list
        // still settles quickly instead of trickling in.
        pill.style.setProperty("--hn-i", String(Math.min(i, 6)));
      });
      menu.replaceChildren(...pills);
      chip.textContent = `+${pills.length}`;
      chip.setAttribute(
        "title",
        getStrings(plugin.settings.language).overflowChip(pills.length),
      );
      // Nothing left over: the chip takes no room at all.
      more.style.display = pills.length > 0 ? "" : "none";
      if (pills.length === 0) close();
    },
  };
}

/**
 * Fit passes, one per single-line section, keyed by the block they belong
 * to. They need the block to be in the document (the fit is measured, not
 * guessed), so `main.ts` runs them right after mounting.
 */
const refitters = new WeakMap<HTMLElement, Array<() => void>>();

/** Re-fit every single-line section of a mounted block to its real width. */
export function refitSections(block: HTMLElement): void {
  for (const refit of refitters.get(block) ?? []) refit();
}

function buildSegment(
  plugin: HierarchyNavigator,
  seg: Segment,
  onRefit: (fn: () => void) => void,
): HTMLElement {
  const root = el("div", { cls: "hn-segment" });
  // Head and body become the two cells of one grid row in `.hn-segments`.
  root.style.setProperty("display", "contents", "important");
  const head = el("div", { cls: "hn-segment-head" });
  head.appendChild(seg.icon);
  head.appendChild(el("span", { cls: "hn-segment-label", text: seg.label }));
  root.appendChild(head);

  const body = el("div", { cls: "hn-segment-body" });
  // A segment is only ever built when it has items — the caller drops an empty
  // section rather than rendering a placeholder, so there is no empty case to
  // handle here.
  // `maxVisibleItems` is the ceiling for a section; anything above it — and
  // in a single line, anything the row cannot physically show — lives in
  // the "+N" panel.
  const cap = Math.max(
    1,
    Math.floor(plugin.settings.maxVisibleItems) || 1,
  );
  const pills = seg.items.map((it) => makePill(plugin, it));
  const list = el("div", { cls: "hn-pills" });
  body.appendChild(list);
  const panel = makeOverflowMenu(plugin);
  const wrap = plugin.settings.sectionLayout === "wrap";
  // Wrapped sections put the chip inside the flowing row, so it trails the
  // last pill; a single line keeps it outside, pinned after the row.
  const chipHome = wrap ? list : body;

  /** Show the first `visible` pills in the row, the rest in the panel. */
  const apply = (visible: number) => {
    const overflow: HTMLElement[] = [];
    pills.forEach((pill, i) => {
      const target = i < visible ? list : panel.menu;
      if (i >= visible) overflow.push(pill);
      if (pill.parentElement !== target) target.appendChild(pill);
    });
    panel.setPills(overflow);
    // Re-append last: moving pills in and out of the row must never leave
    // the chip ahead of them.
    chipHome.appendChild(panel.root);
  };

  const initial = Math.min(cap, pills.length);
  apply(initial);

  if (!wrap && pills.length > initial) {
    // A single clipped line: measure how many pills really fit and hand the
    // rest to the panel, so nothing is ever half-hidden behind the edge.
    const fit = () => {
      if (!list.isConnected) return;
      let visible = initial;
      for (let pass = 0; pass < 4; pass++) {
        apply(visible);
        const edge = list.getBoundingClientRect().right;
        if (edge === 0) return; // not laid out yet — a later pass will do it
        let over = visible;
        for (let i = 0; i < visible; i++) {
          if (list.children[i].getBoundingClientRect().right > edge + 0.5) {
            over = i;
            break;
          }
        }
        if (over === visible) return; // the whole row fits
        // `over` can be 0: in a pane too narrow for even one pill, showing
        // a clipped pill would be worse than showing none — the panel then
        // holds the whole section.
        visible = over;
      }
    };
    onRefit(fit);
    // The row has to be laid out before it can be measured. The caller
    // inserts the block synchronously after this returns, so a microtask
    // measures it before the browser paints; the frame callback is the
    // fallback for callers that insert later.
    queueMicrotask(fit);
    window.requestAnimationFrame(fit);
  }
  root.appendChild(body);
  return root;
}

/* ────────────────────────────────────────────────
   Public entry — build the entire block.
   ──────────────────────────────────────────────── */

export function renderHierarchyBlock(
  plugin: HierarchyNavigator,
  file: TFile,
): HTMLElement {
  const settings = plugin.settings;
  const t = getStrings(settings.language);

  // Collect data into segments up front. A section with nothing to show is
  // dropped outright rather than rendered as an empty placeholder: the block
  // is navigation, and a row that says "nothing here" navigates nowhere.
  // Folder Notes occupy the same hierarchy position as their containing
  // folder. The markdown file is only the navigation target for that node.
  const logicalFolder = logicalFolderForFile(plugin, file);
  const hierarchyFolder = logicalFolder ?? file.parent;
  const parent = logicalFolder?.parent ?? file.parent;

  // The Parent row is only rendered when there is something to navigate
  // to: the containing folder, or — at the vault root — the homepage
  // note from the Homepage plugin. At the root without a homepage (or
  // while already on the homepage itself) the row is dropped entirely.
  const parentSeg: Segment | null = (() => {
    if (!settings.showParent) return null;
    if (parent instanceof TFolder && parent.path !== ROOT) {
      return {
        label: t.parent,
        icon: Icons.chevronUp(),
        items: [makeItem(plugin, parent)],
      };
    }
    const home = resolveHomepageFile(plugin);
    if (!home || home.path === file.path) return null;
    return {
      label: t.parent,
      icon: Icons.chevronUp(),
      items: [{ target: home, name: home.basename, kind: "home" as const }],
    };
  })();

  let siblingsSeg: Segment | null = null;
  if (settings.showSiblings && hierarchyFolder instanceof TFolder) {
    // Siblings are the entries next to our logical node: for a Folder Note
    // that is the folder's own parent, otherwise the file's parent folder.
    const siblingFolder = logicalFolder?.parent ?? file.parent;
    const mePath = logicalFolder?.path ?? file.path;
    const collectedSiblings: Entry[] = [];
    if (siblingFolder instanceof TFolder) {
      collectLogicalChildren(plugin, siblingFolder, collectedSiblings);
    }
    const filtered = collectedSiblings.filter((c) => {
      // The current node is where you already are, so it is never listed:
      // that is the file itself for a plain note, and the folder a Folder
      // Note stands for otherwise.
      if (c.path === mePath || c.path === file.path) return false;
      return c instanceof TFolder ? settings.showFolders : settings.showFiles;
    });
    filtered.sort(compareEntries);
    // Nothing beside this note: the row goes away instead of standing there
    // empty. That is the common case for a lone note in a folder.
    if (filtered.length > 0) {
      siblingsSeg = {
        label: t.siblings,
        icon: Icons.hash(),
        items: filtered.map((s) => makeItem(plugin, s)),
      };
    }
  }

  const childrenSeg: Segment | null = (() => {
    if (!settings.showFolders && !settings.showFiles) return null;
    // A plain note is a leaf: it has no children of its own, and its
    // siblings are not its children — the Siblings row already covers those.
    // Only a Folder Note stands for a folder, and only then is there contents
    // to navigate into.
    if (!(logicalFolder instanceof TFolder)) return null;
    const collected: Entry[] = [];
    collectLogicalChildren(plugin, logicalFolder, collected);
    const filtered = collected.filter((entry) => {
      if (entry.path === file.path) return false;
      return entry instanceof TFolder ? settings.showFolders : settings.showFiles;
    });
    filtered.sort(compareEntries);
    // An empty folder, or a folder whose contents are all filtered out, has
    // no Children row — same rule as everywhere else.
    if (filtered.length === 0) return null;
    return {
      label: t.children,
      icon: Icons.chevronDown(),
      items: filtered.map((c) => makeItem(plugin, c)),
    };
  })();

  // Layout: a 2-row pill — `rail` row on top, `segments` row below
  // (so it stays one visual block). The rail is always there: it carries the
  // header label and the fold toggle, so the block keeps its identity even
  // when every section below it has nothing to show.
  const block = el("div", { cls: BLOCK_CLASS });
  // Section layout rides on the block root so styles.css can switch the
  // pill rows between one clipped line and free wrapping.
  if (settings.sectionLayout === "wrap") block.classList.add("hn-wrap");
  // Inline layout constraints are intentional here: the vault's
  // `list-cards` class applies a grid/flex layout to every direct
  // child of the preview section. A stylesheet rule can lose to that
  // user rule; these scoped inline constraints guarantee that the
  // navigation becomes its own full-width row below the title.
  block.style.setProperty("display", "block", "important");
  block.style.setProperty("grid-column", "1 / -1", "important");
  block.style.setProperty("grid-row", "auto", "important");
  block.style.setProperty("width", "100%", "important");
  block.style.setProperty("max-width", "none", "important");
  block.style.setProperty("margin-left", "0", "important");
  block.style.setProperty("margin-right", "0", "important");
  block.style.setProperty("float", "none", "important");
  block.setAttribute("data-hn-placement", "after-title");
  // The header row doubles as the collapse toggle: clicking anywhere on it
  // folds the whole block. The chevron sits left of the label, following
  // the usual disclosure convention (Notion toggle headings, Obsidian
  // callouts, the file explorer).
  const rail = el("div", { cls: "hn-rail" });
  rail.setAttribute("role", "button");
  rail.setAttribute("tabindex", "0");
  rail.setAttribute("aria-expanded", String(!settings.collapsed));
  rail.appendChild(
    el("div", {
      cls: "hn-rail-left",
      children: [
        el("span", { cls: "hn-rail-toggle", children: [Icons.chevronDown()] }),
        Icons.compass(),
        el("span", { cls: "hn-rail-label", text: settings.headerTitle || "Hierarchy" }),
      ],
    }),
  );
  const applyCollapsed = (next: boolean, animate = true) => {
    block.classList.toggle("hn-collapsed", next);
    rail.setAttribute("aria-expanded", String(!next));
    // Folding hides the body, so close any "+N" panel left open behind it
    // (its own chip handler runs the exit animation); otherwise it would
    // reappear already-expanded on the next unfold.
    if (next) {
      block
        .querySelectorAll<HTMLElement>(".hn-more.hn-open > .hn-more-chip")
        .forEach((openChip) => openChip.click());
    }
    if (!animate || next) return;
    // Expanding: clip the wrapper while the row grows, then release it so
    // the "+N" dropdown can overflow the block again.
    block.classList.add("hn-folding");
    window.setTimeout(() => block.classList.remove("hn-folding"), FOLD_MS + 40);
  };
  const toggleCollapsed = () => {
    const next = !block.classList.contains("hn-collapsed");
    plugin.settings.collapsed = next;
    applyCollapsed(next);
    void plugin.saveSettings();
  };
  rail.addEventListener("click", toggleCollapsed);
  rail.addEventListener("keydown", (ev: KeyboardEvent) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      toggleCollapsed();
    }
  });
  block.appendChild(rail);

  const segments = el("div", { cls: "hn-segments" });
  segments.style.setProperty("display", "grid", "important");
  segments.style.setProperty("grid-template-columns", "max-content 1fr", "important");
  // A wrapped row is taller than one line: keep the section label on the
  // first line instead of floating it in the middle of the stack.
  segments.style.setProperty("align-items", settings.sectionLayout === "wrap" ? "start" : "center", "important");
  segments.style.setProperty("column-gap", "10px", "important");
  segments.style.setProperty("row-gap", "6px", "important");
  const refits: Array<() => void> = [];
  const onRefit = (fn: () => void) => refits.push(fn);
  if (parentSeg) segments.appendChild(buildSegment(plugin, parentSeg, onRefit));
  if (siblingsSeg) segments.appendChild(buildSegment(plugin, siblingsSeg, onRefit));
  if (childrenSeg) segments.appendChild(buildSegment(plugin, childrenSeg, onRefit));
  // The wrapper exists purely so the fold can animate: `grid-template-rows`
  // goes 1fr ↔ 0fr, which cannot be done on `.hn-segments` itself (it has an
  // inline `display: grid !important` and must stay that way).
  const fold = el("div", { cls: "hn-fold" });
  fold.appendChild(segments);
  block.appendChild(fold);

  applyCollapsed(settings.collapsed, false);
  // The fit passes need a laid-out row; `main.ts` runs them once the block
  // is in the document, and again whenever a pane is resized.
  if (refits.length > 0) refitters.set(block, refits);

  return block;
}

/* ────────────────────────────────────────────────
   Eligibility + per-element guard
   ──────────────────────────────────────────────── */

export function isEligible(plugin: HierarchyNavigator, file: TFile | null): file is TFile {
  if (!file) return false;
  if (file.extension !== "md") return false;
  if (isHiddenByFrontmatter(plugin, file)) return false;
  return true;
}


/* ────────────────────────────────────────────────
   Body index — the Children of this note, laid over
   the note body instead of into it.
   ──────────────────────────────────────────────── */

/** Class of the body index overlay — `main.ts` mounts, positions, removes it. */
export const INDEX_CLASS = "hn-index";

/** Everything this plugin owns inside a view: header block + body overlay. */
export const OWNED_SELECTOR = `.${BLOCK_CLASS}, .${INDEX_CLASS}`;

/** Frontmatter block at the very start of a note, for the raw-text fallback. */
const FRONTMATTER_RE = /^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n?/;

/**
 * Coarse relative time — "just now" / "3 hours ago", falling back to a
 * plain date once that stops being useful. Deliberately not built on
 * `Intl.RelativeTimeFormat`: its wording varies far too much between
 * machines, so the phrasing comes from the language table instead.
 */
function relativeTime(ms: number, t: Strings): string {
  const diff = Date.now() - ms;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (!Number.isFinite(ms) || ms <= 0) return "";
  if (diff < minute) return t.justNow;
  if (diff < hour) return t.minutesAgo(Math.round(diff / minute));
  if (diff < day) return t.hoursAgo(Math.round(diff / hour));
  if (diff < 7 * day) return t.daysAgo(Math.round(diff / day));
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Is this note's body empty — only whitespace, or only frontmatter?
 *
 * That is the "nothing written yet" case the overlay exists for. Frontmatter
 * is not body text: a folder note that is nothing but properties is still an
 * empty page. `null` means the metadata cache has not been built yet, so the
 * caller should read the file text rather than guess — a wrong `true` here
 * drops a panel over writing that exists.
 */
export function isNoteBodyEmpty(
  plugin: HierarchyNavigator,
  file: TFile,
): boolean | null {
  const cache = plugin.app.metadataCache.getFileCache(file);
  if (!cache) return null;
  const body = (cache.sections ?? []).filter((s) => s.type !== "yaml");
  return body.length === 0 && !(cache.headings && cache.headings.length > 0);
}

/** The same question answered from raw text, for files with no cache yet. */
export function isRawBodyEmpty(text: string): boolean {
  return text.replace(FRONTMATTER_RE, "").trim() === "";
}

/**
 * The body index: a Children-only launcher, laid *over* the note body.
 *
 * It is deliberately not part of the document flow. An empty note has nothing
 * to push around, and taking the overlay away never moves the text by a pixel
 * — which a block inserted into the document could not promise. `main.ts`
 * gives it a `top` (the bottom edge of the header block), mounts it in the
 * pane's content element, and only ever does so in reading mode: an overlay
 * has no business covering the editor you are writing in.
 *
 * Returns null when there is nothing worth showing, so callers can skip it.
 */
export function renderBodyIndex(
  plugin: HierarchyNavigator,
  file: TFile,
): HTMLElement | null {
  if (!plugin.settings.showBodyIndex) return null;
  if (!plugin.settings.showFolders && !plugin.settings.showFiles) return null;

  // Same rule as the header block: only a Folder Note stands for a folder, so
  // only a Folder Note has contents to index. A plain note is a leaf — listing
  // its folder's other entries here would just repeat the Siblings row.
  const folder = logicalFolderForFile(plugin, file);
  if (!(folder instanceof TFolder) || folder.path === ROOT) return null;

  const collected: Entry[] = [];
  collectLogicalChildren(plugin, folder, collected);
  const items = collected
    .filter((entry) => {
      if (entry.path === file.path) return false;
      return entry instanceof TFolder
        ? plugin.settings.showFolders
        : plugin.settings.showFiles;
    })
    .sort(compareEntries);
  if (items.length === 0) return null;

  const root = el("div", { cls: INDEX_CLASS, attr: { "data-hn-file": file.path } });
  const t = getStrings(plugin.settings.language);

  /* ── Head: label, counts, and the way into the note ── */
  const folders = items.filter((i) => i instanceof TFolder).length;
  const files = items.length - folders;
  const inner = el("div", { cls: "hn-index-inner" });
  const head = el("div", { cls: "hn-index-head" });
  head.appendChild(Icons.grid());
  head.appendChild(el("span", { cls: "hn-index-title", text: t.bodyIndexTitle }));
  head.appendChild(
    el("span", {
      cls: "hn-index-count",
      text: t.bodyIndexCounts(folders, files),
    }),
  );
  inner.appendChild(head);

  /* ── Body: one calm list, folders first — the sort already put them there.
     Folder rows are bold and count their items; file rows carry the modified
     time. No tiles, no panel: a launcher, not a dashboard. ── */
  const body = el("div", { cls: "hn-index-body" });
  for (const entry of items) {
    const isDir = entry instanceof TFolder;
    const folderEntry = isDir ? (entry as TFolder) : null;
    const fileEntry = isDir ? null : (entry as TFile);
    const folderNote = folderEntry ? findFolderNoteFile(plugin, folderEntry) : null;

    const row = el("a", {
      cls:
        `hn-index-row${isDir ? " hn-index-dir" : ""}` +
        (fileEntry ? ` ${fileTypeClass(fileEntry.extension)}` : "") +
        (folderNote ? " hn-kind-folder-note" : ""),
      attr: { href: entry.path },
    });
    row.appendChild(
      folderEntry
        ? folderNote
          ? Icons.folderNote()
          : Icons.folder()
        : fileTypeIcon((fileEntry as TFile).extension),
    );
    row.appendChild(
      el("span", {
        cls: "hn-index-name",
        text: folderEntry ? folderEntry.name : (fileEntry as TFile).basename,
      }),
    );
    row.appendChild(
      el("span", {
        cls: "hn-index-meta",
        text: folderEntry
          ? t.folderItemCount(folderEntry.children?.length ?? 0)
          : relativeTime((fileEntry as TFile).stat?.mtime ?? 0, t),
      }),
    );
    row.addEventListener("click", (ev) => {
      ev.preventDefault();
      openTarget(plugin, folderNote ?? entry);
    });
    body.appendChild(row);
  }
  inner.appendChild(body);
  root.appendChild(inner);

  return root;
}
