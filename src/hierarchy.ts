import { TFile, TFolder, TAbstractFile } from "obsidian";
import type { AnyApp, FolderNoteAPI, HomepagePluginAPI } from "./types";
import type HierarchyNavigator from "./main";

const ROOT = "/";
const FOLDER_NOTE_SUFFIX = ".md";

/** Folder Notes are logical folder nodes, even though Obsidian stores them as files. */
export function isFolderNote(plugin: HierarchyNavigator, file: TFile): boolean {
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

export function isHiddenByFrontmatter(
  plugin: HierarchyNavigator,
  file: TFile,
): boolean {
  const frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter;
  if (!frontmatter) return false;
  return frontmatter["hierarchy-nav"] === "hide" ||
    frontmatter["hierarchy_nav"] === "hide" ||
    frontmatter["hn-hide"] === true ||
    frontmatter["hn-hide"] === "true";
}

export function findFolderNoteFile(
  plugin: HierarchyNavigator,
  folder: TFolder,
): TFile | null {
  const candidate = `${folder.path}/${folder.name}${FOLDER_NOTE_SUFFIX}`;
  const af: TAbstractFile | null =
    plugin.app.vault.getAbstractFileByPath(candidate);
  return af instanceof TFile ? af : null;
}

const FALLBACK_SUPPORTED_EXTENSIONS = new Set([
  "md", "canvas", "base", "pdf",
  "png", "jpg", "jpeg", "gif", "bmp", "svg", "webp", "avif",
  "mp3", "wav", "m4a", "ogg", "3gp", "flac",
  "mp4", "webm", "ogv", "mov", "mkv",
]);

/** Use Obsidian's own view registry so navigation only lists openable files. */
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

export function logicalFolderForFile(
  plugin: HierarchyNavigator,
  file: TFile,
): TFolder | null {
  if (!isFolderNote(plugin, file)) return null;
  return file.parent instanceof TFolder ? file.parent : null;
}

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

export function getParentTarget(
  plugin: HierarchyNavigator,
  file: TFile,
): TFile | TFolder | null {
  const logicalFolder = logicalFolderForFile(plugin, file);
  const parent = logicalFolder?.parent ?? file.parent;
  if (parent instanceof TFolder && parent.path !== ROOT) return parent;
  const home = resolveHomepageFile(plugin);
  return home && home.path !== file.path ? home : null;
}

function collectLogicalChildren(
  plugin: HierarchyNavigator,
  folder: TFolder,
  out: Array<TFile | TFolder>,
): void {
  for (const child of folder.children ?? []) {
    if (!(child instanceof TFile || child instanceof TFolder)) continue;
    if (child instanceof TFile && isFolderNoteFile(plugin, child, folder)) continue;
    if (child instanceof TFile && !isSupportedByObsidian(plugin, child)) continue;
    out.push(child);
  }
}

export type Entry = TFile | TFolder;

function compareEntries(a: Entry, b: Entry): number {
  const aIsFolder = a instanceof TFolder;
  const bIsFolder = b instanceof TFolder;
  if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function getVisibleChildren(
  plugin: HierarchyNavigator,
  folder: TFolder,
  excludePaths: ReadonlySet<string> = new Set(),
): Entry[] {
  const collected: Entry[] = [];
  collectLogicalChildren(plugin, folder, collected);
  return collected
    .filter((entry) => {
      if (excludePaths.has(entry.path)) return false;
      return entry instanceof TFolder
        ? plugin.settings.showFolders
        : plugin.settings.showFiles;
    })
    .sort(compareEntries);
}

export function getChildrenForFile(
  plugin: HierarchyNavigator,
  file: TFile,
): Entry[] {
  const folder = logicalFolderForFile(plugin, file);
  if (!(folder instanceof TFolder)) return [];
  return getVisibleChildren(plugin, folder, new Set([file.path]));
}

function isFolderNoteFile(
  plugin: HierarchyNavigator,
  entry: Entry,
  folder: TFolder,
): boolean {
  if (!(entry instanceof TFile)) return false;
  return entry.path === findFolderNoteFile(plugin, folder)?.path;
}

export function isEligible(plugin: HierarchyNavigator, file: TFile | null): file is TFile {
  if (!file) return false;
  if (file.extension !== "md") return false;
  if (isHiddenByFrontmatter(plugin, file)) return false;
  return true;
}

export { ROOT };
