import { TFolder, type FileManager, type TFile } from "obsidian";
import type HierarchyNavigator from "./main";

/* ────────────────────────────────────────────────
   Creating a child of a folder note — the one
   place this plugin writes to the vault.
   ──────────────────────────────────────────────── */

/** What the create dialog was asked to make. */
export type CreateKind = "note" | "folder";

export interface CreateRequest {
  kind: CreateKind;
  /** Raw text from the name field. Normalised here, not by the caller. */
  name: string;
  /** Folder only: also drop `<folder>/<folder>.md` beside it. */
  folderNote: boolean;
  /** Only retry Folder Note creation for a folder created in this dialog. */
  retryPartialFolder?: TFolder;
}

/**
 * What actually happened. Failures are values rather than exceptions because
 * every one of them is something the dialog has to say out loud — and it has
 * to stay open so the name can be fixed.
 */
export type CreateResult =
  | { ok: true; kind: "note"; file: TFile }
  | { ok: true; kind: "folder"; folder: TFolder; folderNote: TFile | null }
  | {
      ok: false;
      reason: "invalid" | "exists" | "failed" | "partial";
      folder?: TFolder;
      error?: unknown;
    };

/** Characters no vault path may hold — the separator included. */
const INVALID_NAME = /[\\/:*?"<>|]/;
/** Control characters, which `vault.create` rejects as well. */
const CONTROL_CHARS = /[\u0000-\u001f]/;

/**
 * `fileManager.createNewMarkdownFile` is what Obsidian's own "New note" calls:
 * it is the only way to get the user's default frontmatter and template
 * applied. It exists at runtime but is missing from `obsidian`'s typings, so
 * it is duck-typed here and `vault.create` is the fallback.
 */
type FileManagerWithCreate = FileManager & {
  createNewMarkdownFile?: (folder: TFolder, filename: string) => Promise<TFile>;
};

/** The name as it will hit the disk: trimmed, and without a typed `.md`. */
export function normalizeName(kind: CreateKind, raw: string): string {
  const name = raw.trim();
  // "Foo.md" and "Foo .md" both mean the note "Foo" — the extension is a
  // hint at what you are making, not part of its name.
  return kind === "note" ? name.replace(/\s*\.md$/i, "") : name;
}

/** Empty, "." / "..", or holding something a path cannot. */
export function isUsableName(name: string): boolean {
  if (!name || name === "." || name === "..") return false;
  return !INVALID_NAME.test(name) && !CONTROL_CHARS.test(name);
}

/** Vault-absolute path of `name` inside `parent`. */
export function pathIn(parent: TFolder, name: string): string {
  return parent.path === "/" ? name : `${parent.path}/${name}`;
}

async function createMarkdownFile(
  plugin: HierarchyNavigator,
  folder: TFolder,
  name: string,
): Promise<TFile> {
  const manager = plugin.app.fileManager as FileManagerWithCreate;
  if (typeof manager?.createNewMarkdownFile === "function") {
    return await manager.createNewMarkdownFile(folder, name);
  }
  return await plugin.app.vault.create(`${pathIn(folder, name)}.md`, "");
}

/**
 * Create a note or a folder inside `parent`.
 *
 * Nothing here overwrites: an occupied path comes back as `exists` and is
 * left alone, and the caller keeps the dialog open so the name can be fixed.
 * A new folder can bring its own FolderNote — the same `${folder.name}.md`
 * convention the rest of the plugin navigates by, so the folder is a node in
 * the hierarchy the moment it appears.
 *
 * The result describes what appeared; what to say about it, and whether to
 * open it, is the caller's call.
 */
export async function createChild(
  plugin: HierarchyNavigator,
  parent: TFolder,
  request: CreateRequest,
): Promise<CreateResult> {
  const name = normalizeName(request.kind, request.name);
  if (!isUsableName(name)) return { ok: false, reason: "invalid" };

  const vault = plugin.app.vault;
  const path = pathIn(parent, name);
  // A note occupies `<path>.md`, so checking the bare path would sail straight
  // past the one thing it can collide with and let the vault throw instead.
  // (A *folder* of the same name is fine and deliberately allowed — that is
  // exactly the `<folder>/<folder>.md` shape a FolderNote uses.)
  const occupied = request.kind === "note" ? `${path}.md` : path;
  const existing = vault.getAbstractFileByPath(occupied);
  if (existing) {
    // A previous attempt may have created the folder but failed while adding
    // its Folder Note. Treat that state as a repair operation instead of
    // making the user rename an otherwise valid folder.
    if (
      request.kind === "folder" &&
      request.folderNote &&
      request.retryPartialFolder?.path === existing.path &&
      existing instanceof TFolder &&
      !vault.getAbstractFileByPath(`${path}/${name}.md`)
    ) {
      try {
        const folderNote = await createMarkdownFile(plugin, existing, name);
        return { ok: true, kind: "folder", folder: existing, folderNote };
      } catch (error) {
        return { ok: false, reason: "partial", folder: existing, error };
      }
    }
    return { ok: false, reason: "exists" };
  }

  try {
    if (request.kind === "note") {
      const file = await createMarkdownFile(plugin, parent, name);
      return { ok: true, kind: "note", file };
    }

    const folder = await vault.createFolder(path);
    let folderNote: TFile | null = null;
    if (request.folderNote) {
      const notePath = `${path}/${name}.md`;
      if (!vault.getAbstractFileByPath(notePath)) {
        try {
          folderNote = await createMarkdownFile(plugin, folder, name);
        } catch (error) {
          return { ok: false, reason: "partial", folder, error };
        }
      }
    }
    return { ok: true, kind: "folder", folder, folderNote };
  } catch (error) {
    return { ok: false, reason: "failed", error };
  }
}
