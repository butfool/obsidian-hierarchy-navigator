import { Plugin, App } from "obsidian";

/** Interface languages this plugin ships. */
export type Locale = "zh" | "en";

export interface HierarchyNavigatorSettings {
  /**
   * Language of the plugin's own interface — the block labels, the body
   * index and the settings tab. Never the notes themselves.
   */
  language: Locale;

  /** Header text shown above the block. */
  headerTitle: string;

  /* ── Section toggles ── */
  /** Show the parent folder row. */
  showParent: boolean;
  /** Show folders in children list. */
  showFolders: boolean;
  /** Show files in children list. */
  showFiles: boolean;
  /** Show siblings (same folder as the current file), excluding the current node. */
  showSiblings: boolean;
  /**
   * Render the Children index block in the note body, below the header
   * block. It lists the same children as the header's Children row, but
   * as a full collection view with per-item metadata.
   */
  showBodyIndex: boolean;

  /* ── Create ── */
  /**
   * Show a create button in the body index. This is the plugin's only write
   * path: it adds a new note or folder and never touches an existing one, so
   * it is also the one switch that makes the plugin strictly read-only again.
   */
  enableCreate: boolean;

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
  language: "zh",
  headerTitle: "Hierarchy",
  showParent: true,
  showFolders: true,
  showFiles: true,
  showSiblings: false,
  showBodyIndex: true,
  enableCreate: true,
  sectionLayout: "single-line",
  maxVisibleItems: 6,
  collapsed: false,
};

/** Loose typing for a Folder Note plugin's optional runtime API surface. */
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
