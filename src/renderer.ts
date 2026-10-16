import { TFile, TFolder } from "obsidian";
import type HierarchyNavigator from "./main";
import { Icons, fileTypeIcon, fileTypeClass } from "./icons";
import { getStrings } from "./i18n";
import { el } from "./ui/dom";
import { openTarget } from "./ui/navigation";
import type { Entry } from "./hierarchy";
import {
  findFolderNoteFile,
  getChildrenForFile,
  getParentTarget,
  getVisibleChildren,
  logicalFolderForFile,
} from "./hierarchy";

export const BLOCK_CLASS = "hn-root";
export const INDEX_CLASS = "hn-index";
export const OWNED_SELECTOR = `.${BLOCK_CLASS}, .${INDEX_CLASS}`;
export const PROPERTIES_SELECTOR = ".metadata-container, .metadata-properties";

const FOLD_MS = 180;
const MENU_MS = 140;
const MENU_HOVER_OPEN_MS = 60;
const MENU_HOVER_CLOSE_MS = 240;

interface SegmentItem {
  target: TFile | TFolder;
  name: string;
  kind: "file" | "dir" | "folder-note" | "home";
  ext?: string;
}

interface Segment {
  label: string;
  icon: SVGElement;
  items: SegmentItem[];
}

function makeItem(plugin: HierarchyNavigator, entry: Entry): SegmentItem {
  if (entry instanceof TFolder) {
    const note = findFolderNoteFile(plugin, entry);
    return {
      target: note ?? entry,
      name: entry.name,
      kind: note ? "folder-note" : "dir",
    };
  }
  return {
    target: entry,
    name: entry.basename,
    kind: "file",
    ext: entry.extension,
  };
}

function itemIcon(item: SegmentItem): SVGElement {
  if (item.kind === "folder-note") return Icons.folderNote();
  if (item.kind === "home") return Icons.home();
  if (item.kind === "dir") return Icons.folder();
  if (item.ext !== undefined) return fileTypeIcon(item.ext);
  return Icons.file();
}

function makePill(plugin: HierarchyNavigator, item: SegmentItem): HTMLElement {
  const typeMod = item.kind === "file" && item.ext !== undefined
    ? ` ${fileTypeClass(item.ext)}`
    : "";
  const pill = el(item.target instanceof TFile ? "a" : "button", {
    cls: `hn-pill hn-kind-${item.kind}${typeMod}`,
    attr: item.target instanceof TFile
      ? { href: item.target.path, "data-href": item.target.path }
      : { type: "button", "data-href": item.target.path },
  });
  pill.appendChild(itemIcon(item));
  pill.appendChild(el("span", { cls: "hn-pill-name", text: item.name }));
  pill.addEventListener("click", (event) => {
    event.preventDefault();
    openTarget(plugin, item.target);
  });
  return pill;
}

interface OverflowPanel {
  root: HTMLElement;
  setItems(items: SegmentItem[]): void;
}

const refitters = new WeakMap<HTMLElement, Array<() => void>>();
const overflowDestroyers = new WeakMap<HTMLElement, () => void>();

function makeOverflowMenu(plugin: HierarchyNavigator): OverflowPanel {
  const more = el("details", { cls: "hn-more" });
  const chip = el("summary", { cls: "hn-more-chip", text: "+0" });
  const menu = el("div", { cls: "hn-more-menu" });
  more.append(chip, menu);

  let items: SegmentItem[] = [];
  let openTimer = 0;
  let closeTimer = 0;
  let hideTimer = 0;
  let pointerInside = false;
  let dismissedByClick = false;

  const isOpen = () => more.classList.contains("hn-open");
  const renderItems = () => {
    if (menu.childElementCount > 0 || items.length === 0) return;
    menu.replaceChildren(...items.map((item, index) => {
      const pill = makePill(plugin, item);
      pill.setCssProps({ "--hn-i": String(Math.min(index, 6)) });
      return pill;
    }));
  };
  const open = () => {
    if (isOpen()) return;
    window.clearTimeout(hideTimer);
    window.clearTimeout(closeTimer);
    more.open = true;
    renderItems();
    void menu.offsetHeight;
    more.setCssProps({ "--hn-bridge-w": `${menu.offsetWidth}px` });
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

  chip.addEventListener("click", (event) => {
    event.preventDefault();
    if (isOpen()) {
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
  more.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !isOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    close();
    chip.focus();
  });

  const onPointerDown = (event: PointerEvent) => {
    if (isOpen() && !more.contains(event.target as Node)) close();
  };
  document.addEventListener("pointerdown", onPointerDown, true);
  overflowDestroyers.set(more, () => {
    window.clearTimeout(openTimer);
    window.clearTimeout(closeTimer);
    window.clearTimeout(hideTimer);
    document.removeEventListener("pointerdown", onPointerDown, true);
    more.open = false;
  });

  return {
    root: more,
    setItems(nextItems) {
      items = nextItems;
      menu.replaceChildren();
      if (isOpen()) renderItems();
      chip.textContent = `+${items.length}`;
      chip.setAttribute(
        "title",
        getStrings(plugin.settings.language).overflowChip(items.length),
      );
      more.classList.toggle("hn-hidden", items.length === 0);
      if (items.length === 0) close();
    },
  };
}

export function destroyOwnedElement(element: HTMLElement): void {
  const menus = [
    ...(element.matches(".hn-more") ? [element] : []),
    ...Array.from(element.querySelectorAll<HTMLElement>(".hn-more")),
  ];
  menus.forEach((menu) => {
    overflowDestroyers.get(menu)?.();
    overflowDestroyers.delete(menu);
  });
  refitters.delete(element);
}

export function refitSections(block: HTMLElement): void {
  for (const refit of refitters.get(block) ?? []) refit();
}

function buildSegment(
  plugin: HierarchyNavigator,
  segment: Segment,
  onRefit: (fn: () => void) => void,
): HTMLElement {
  const root = el("div", { cls: "hn-segment" });
  const head = el("div", { cls: "hn-segment-head" });
  head.append(segment.icon, el("span", {
    cls: "hn-segment-label",
    text: segment.label,
  }));
  root.appendChild(head);

  const body = el("div", { cls: "hn-segment-body" });
  const cap = Math.max(1, Math.floor(plugin.settings.maxVisibleItems) || 1);
  const pills = segment.items.slice(0, cap).map((item) => makePill(plugin, item));
  const list = el("div", { cls: "hn-pills" });
  const panel = makeOverflowMenu(plugin);
  const wrap = plugin.settings.sectionLayout === "wrap";
  const chipHome = wrap ? list : body;
  body.appendChild(list);

  const apply = (visible: number) => {
    pills.forEach((pill, index) => {
      if (index < visible) {
        if (pill.parentElement !== list) list.appendChild(pill);
      } else {
        pill.remove();
      }
    });
    panel.setItems(segment.items.slice(visible));
    chipHome.appendChild(panel.root);
  };

  const initial = Math.min(cap, pills.length);
  apply(initial);
  if (!wrap && pills.length > 0) {
    const fit = () => {
      if (!list.isConnected) return;
      let visible = initial;
      for (let pass = 0; pass < 4; pass++) {
        apply(visible);
        const edge = list.getBoundingClientRect().right;
        if (edge === 0) return;
        let over = visible;
        for (let index = 0; index < visible; index++) {
          if (list.children[index].getBoundingClientRect().right > edge + 0.5) {
            over = index;
            break;
          }
        }
        if (over === visible) {
          if (visible < pills.length) {
            const chipWidth = panel.root.getBoundingClientRect().width;
            if (list.getBoundingClientRect().right + chipWidth >
                body.getBoundingClientRect().right + 0.5) {
              visible -= 1;
              continue;
            }
          }
          return;
        }
        visible = over;
      }
    };
    onRefit(fit);
    queueMicrotask(fit);
    window.requestAnimationFrame(fit);
  }
  root.appendChild(body);
  return root;
}

function buildSegments(
  plugin: HierarchyNavigator,
  file: TFile,
  onRefit: (fn: () => void) => void,
): HTMLElement {
  const settings = plugin.settings;
  const strings = getStrings(settings.language);
  const logicalFolder = logicalFolderForFile(plugin, file);
  const hierarchyFolder = logicalFolder ?? file.parent;
  const segments = el("div", { cls: "hn-segments" });
  segments.classList.toggle("hn-wrap", settings.sectionLayout === "wrap");

  const parentTarget = settings.showParent ? getParentTarget(plugin, file) : null;
  if (parentTarget) {
    const item = parentTarget instanceof TFolder
      ? makeItem(plugin, parentTarget)
      : {
          target: parentTarget,
          name: parentTarget.basename,
          kind: "home" as const,
        };
    segments.appendChild(buildSegment(plugin, {
      label: strings.parent,
      icon: Icons.chevronUp(),
      items: [item],
    }, onRefit));
  }

  if (settings.showSiblings && hierarchyFolder instanceof TFolder) {
    const siblingFolder = logicalFolder?.parent ?? file.parent;
    const exclude = new Set([logicalFolder?.path ?? file.path, file.path]);
    const siblings = siblingFolder instanceof TFolder
      ? getVisibleChildren(plugin, siblingFolder, exclude)
      : [];
    if (siblings.length > 0) {
      segments.appendChild(buildSegment(plugin, {
        label: strings.siblings,
        icon: Icons.hash(),
        items: siblings.map((entry) => makeItem(plugin, entry)),
      }, onRefit));
    }
  }

  if (settings.showFolders || settings.showFiles) {
    const children = getChildrenForFile(plugin, file);
    if (children.length > 0) {
      segments.appendChild(buildSegment(plugin, {
        label: strings.children,
        icon: Icons.chevronDown(),
        items: children.map((entry) => makeItem(plugin, entry)),
      }, onRefit));
    }
  }
  return segments;
}

export function renderHierarchyBlock(
  plugin: HierarchyNavigator,
  file: TFile,
): HTMLElement {
  const settings = plugin.settings;
  const block = el("div", { cls: BLOCK_CLASS });
  block.classList.toggle("hn-wrap", settings.sectionLayout === "wrap");
  block.setAttribute("data-hn-placement", "after-title");

  const rail = el("div", { cls: "hn-rail" });
  rail.setAttribute("role", "button");
  rail.setAttribute("tabindex", "0");
  rail.setAttribute("aria-expanded", String(!settings.collapsed));
  rail.appendChild(el("div", {
    cls: "hn-rail-left",
    children: [
      el("span", { cls: "hn-rail-toggle", children: [Icons.chevronDown()] }),
      Icons.compass(),
      el("span", { cls: "hn-rail-label", text: settings.headerTitle || "Hierarchy" }),
    ],
  }));

  const applyCollapsed = (collapsed: boolean, animate = true) => {
    block.classList.toggle("hn-collapsed", collapsed);
    rail.setAttribute("aria-expanded", String(!collapsed));
    if (collapsed) {
      block.querySelectorAll<HTMLElement>(".hn-more.hn-open > .hn-more-chip")
        .forEach((chip) => chip.click());
    }
    if (!animate || collapsed) return;
    block.classList.add("hn-folding");
    window.setTimeout(() => block.classList.remove("hn-folding"), FOLD_MS + 40);
  };
  const toggleCollapsed = () => {
    const collapsed = !block.classList.contains("hn-collapsed");
    plugin.settings.collapsed = collapsed;
    applyCollapsed(collapsed);
    void plugin.saveSettings().catch(() => {
      // The current view already reflects the setting; the next refresh retries persistence.
    });
  };
  rail.addEventListener("click", toggleCollapsed);
  rail.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleCollapsed();
    }
  });
  block.appendChild(rail);

  const refits: Array<() => void> = [];
  const fold = el("div", { cls: "hn-fold" });
  fold.appendChild(buildSegments(plugin, file, (refit) => refits.push(refit)));
  block.appendChild(fold);
  applyCollapsed(settings.collapsed, false);
  if (refits.length > 0) refitters.set(block, refits);
  return block;
}
