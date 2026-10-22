import { TFile, TFolder } from "obsidian";
import type HierarchyNavigator from "../main";
import { Icons, fileTypeIcon, fileTypeClass } from "../icons";
import { getStrings, type Strings } from "../i18n";
import { promptCreateChild } from "../createModal";
import { el } from "../ui/dom";
import { openTarget } from "../ui/navigation";
import {
  ROOT,
  findFolderNoteFile,
  getChildrenForFile,
  logicalFolderForFile,
} from "../hierarchy";

export const INDEX_CLASS = "hn-index";
export const PROPERTIES_SELECTOR = ".metadata-container, .metadata-properties";

function removeFrontmatter(text: string): string {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return text;
  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  return closing < 0 ? text : lines.slice(closing + 1).join("\n");
}

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

export function isNoteBodyEmpty(
  plugin: HierarchyNavigator,
  file: TFile,
): boolean | null {
  const cache = plugin.app.metadataCache.getFileCache(file);
  if (!cache) return null;
  const body = (cache.sections ?? []).filter((s) => s.type !== "yaml");
  return body.length === 0 && !(cache.headings && cache.headings.length > 0);
}

export function isRawBodyEmpty(text: string): boolean {
  return removeFrontmatter(text).trim() === "";
}

function makeCreateButton(
  plugin: HierarchyNavigator,
  folder: TFolder,
  empty = false,
): HTMLElement {
  const t = getStrings(plugin.settings.language);
  const label = empty ? t.createChildAction : t.createAction;
  const button = el("button", {
    cls: "hn-index-new",
    attr: { type: "button", "aria-label": label, title: label },
    children: [
      Icons.plus(),
      el("span", { cls: "hn-index-new-label", text: label }),
    ],
  });
  button.addEventListener("click", (ev) => {
    ev.preventDefault();
    promptCreateChild(plugin, folder);
  });
  return button;
}

export function renderBodyIndex(
  plugin: HierarchyNavigator,
  file: TFile,
): HTMLElement | null {
  if (!plugin.settings.showBodyIndex) return null;
  if (!plugin.settings.showFolders && !plugin.settings.showFiles) return null;

  const folder = logicalFolderForFile(plugin, file);
  if (!(folder instanceof TFolder) || folder.path === ROOT) return null;

  const items = getChildrenForFile(plugin, file);
  if (items.length === 0 && !plugin.settings.enableCreate) return null;

  const root = el("div", { cls: INDEX_CLASS, attr: { "data-hn-file": file.path } });
  const t = getStrings(plugin.settings.language);
  const folders = items.filter((i) => i instanceof TFolder).length;
  const files = items.length - folders;
  const inner = el("div", { cls: "hn-index-inner" });
  if (items.length === 0) {
    root.classList.add("hn-index-empty");
    inner.appendChild(makeCreateButton(plugin, folder, true));
    root.appendChild(inner);
    return root;
  }
  const head = el("div", { cls: "hn-index-head" });
  head.appendChild(Icons.grid());
  head.appendChild(el("span", { cls: "hn-index-title", text: t.bodyIndexTitle }));
  head.appendChild(el("span", {
    cls: "hn-index-count",
    text: t.bodyIndexCounts(folders, files),
  }));

  if (plugin.settings.enableCreate) {
    head.appendChild(el("span", { cls: "hn-index-spacer" }));
    head.appendChild(makeCreateButton(plugin, folder));
  }
  inner.appendChild(head);

  const body = el("div", { cls: "hn-index-body" });
  for (const entry of items) {
    const row = el("a", { cls: "hn-index-row", attr: { href: entry.path } });
    if (entry instanceof TFolder) {
      const folderNote = findFolderNoteFile(plugin, entry);
      row.classList.add("hn-index-dir");
      if (folderNote) row.classList.add("hn-kind-folder-note");
      row.appendChild(folderNote ? Icons.folderNote() : Icons.folder());
      row.appendChild(el("span", { cls: "hn-index-name", text: entry.name }));
      row.appendChild(el("span", {
        cls: "hn-index-meta",
        text: t.folderItemCount(entry.children?.length ?? 0),
      }));
      row.addEventListener("click", (ev) => {
        ev.preventDefault();
        openTarget(plugin, folderNote ?? entry);
      });
    } else if (entry instanceof TFile) {
      row.classList.add(fileTypeClass(entry.extension));
      row.appendChild(fileTypeIcon(entry.extension));
      row.appendChild(el("span", { cls: "hn-index-name", text: entry.basename }));
      row.appendChild(el("span", {
        cls: "hn-index-meta",
        text: relativeTime(entry.stat?.mtime ?? 0, t),
      }));
      row.addEventListener("click", (ev) => {
        ev.preventDefault();
        openTarget(plugin, entry);
      });
    } else {
      continue;
    }
    body.appendChild(row);
  }
  inner.appendChild(body);
  root.appendChild(inner);
  return root;
}
