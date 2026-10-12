import { Plugin, App } from "obsidian";

export interface HierarchyNavigatorSettings {
  /** Header text shown above the block. */
  headerTitle: string;

  /* ── Section toggles ── */
  /** Show the parent folder row. */
  showParent: boolean;
  /** Show folders in children list. */
  showFolders: boolean;
  /** Show files in children list. */
  showFiles: boolean;
  /** Show siblings (same folder as the current file). Includes self. */
  showSiblings: boolean;

  /* ── Layout ── */
  /**
   * How a section lays its items out:
   * - single-line: one row, items past `maxVisibleItems` — and anything the
   *   row can't fit — stay reachable only through the "+N" panel.
   * - wrap: items flow onto as many rows as they need, up to
   *   `maxVisibleItems`, with the remainder in the "+N" panel.
   */
  sectionLayout: "single-line" | "wrap";
  /**
   * Max items rendered per section. Extra items collapse into a "+N"
   * dropdown; in `wrap` layout this is the cap across all rows.
   */
  maxVisibleItems: number;
  /**
   * Whether the whole block is folded away. Toggled by clicking the
   * header row; persisted so it survives file switches.
   */
  collapsed: boolean;
}

export const DEFAULT_SETTINGS: HierarchyNavigatorSettings = {
  headerTitle: "Hierarchy",
  showParent: true,
  showFolders: true,
  showFiles: true,
  showSiblings: false,
  sectionLayout: "single-line",
  maxVisibleItems: 6,
  collapsed: false,
};

/** Loose typing for the AidenLX Folder Note API surface. */
export interface FolderNoteAPI {
  fn?: {
    folderMFiles?: Set<string>;
  };
}

/**
 * `app.plugins` is part of Obsidian's runtime but isn't on the
 * strict `App` type — wrap it loosely for plugin-internal use.
 */
export type AnyApp = App & {
  plugins: {
    plugins: Record<string, unknown>;
  };
};

/** Loose typing for the community "Homepage" plugin's runtime state. */
export interface HomepagePluginAPI {
  settings?: {
    homepages?: Record<string, { value?: string; kind?: string } | undefined>;
  };
}

export interface HierarchyNavigatorPlugin extends Plugin {
  settings: HierarchyNavigatorSettings;
  saveSettings(): Promise<void>;
  loadSettings(): Promise<void>;
  /** Re-render the block in every open markdown view. */
  refresh(): void;
}
