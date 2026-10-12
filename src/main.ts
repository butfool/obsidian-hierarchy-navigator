import {
  Plugin,
  TFile,
  MarkdownView,
  WorkspaceLeaf,
  View,
} from "obsidian";
import {
  DEFAULT_SETTINGS,
  HierarchyNavigatorSettings,
  AnyApp,
  HierarchyNavigatorPlugin,
} from "./types";
import { HierarchyNavigatorSettingTab } from "./settingTab";
import {
  renderHierarchyBlock,
  refitSections,
  isEligible,
  BLOCK_CLASS,
} from "./renderer";

const PLUGIN_NAME = "Hierarchy Navigator";

export default class HierarchyNavigator
  extends Plugin
  implements HierarchyNavigatorPlugin
{
  public settings: HierarchyNavigatorSettings;
  private pendingTitleRetries = new WeakSet<WorkspaceLeaf>();

  async onload(): Promise<void> {
    await this.loadSettings();

    // ── Strategy ──────────────────────────────────────────────────────
    //
    // We do NOT use `registerMarkdownPostProcessor` to inject our
    // block. Every embed / Base card / Dataview block creates a
    // nested markdown preview, and a post-processor registered
    // globally fires for *each* of them — that's why we used to see
    // the block repeated. (See forum threads like "Multiple Base
    // Views in single markdown file get reset" and the
    // `MarkdownPostProcessor` docs: the post-processor is for
    // transforming nodes *inside* the rendered document, not for
    // adding structural chrome.)
    //
    // Instead, attach a single instance of the block to the *root
    // markdown container of the current view*, exactly once, and
    // keep it in sync with the active file as the user navigates.
    //
    //   Active MarkdownView changes → mount in the new view.
    //   Layout change → re-mount.
    //   View closes → node is detached automatically (we never
    //   append to anything we don't own).
    //
    // We listen for:
    //   1. `active-leaf-change` — to mount in the new view.
    //   2. `layout-change`     — for re-mounts on sidebar / splits.
    //   3. `file-open`         — to re-evaluate frontmatter rules
    //                            (hierarchy-nav: hide) on the new file.

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        if (leaf) this.mountInto(leaf as WorkspaceLeaf);
      }),
    );

    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.syncAllOpenLeaves()),
    );

    this.registerEvent(
      this.app.workspace.on("file-open", () => this.syncActiveLeaf()),
    );

    // Resizing a pane changes how many pills fit on a line; re-fit rather
    // than re-render, so an open "+N" panel survives the drag.
    this.registerEvent(
      this.app.workspace.on("resize", () => {
        this.iterateMarkdownViews((view) => {
          view.contentEl.querySelectorAll<HTMLElement>(`.${BLOCK_CLASS}`).forEach(refitSections);
        });
      }),
    );

    // Initial mount for the leaf already open at plugin load time.
    this.syncAllOpenLeaves();

    // ── Commands ──
    this.addCommand({
      id: "reveal-parent",
      name: "Reveal parent folder in file explorer",
      checkCallback: (checking) => {
        const file = this.activeFile();
        if (!file || !isEligible(this, file)) return false;
        if (checking) return true;

        const explorer = this.app.workspace.getLeavesOfType("file-explorer")[0] as
          | { view?: { revealInFolder?: (t: unknown) => void } }
          | undefined;
        if (file.parent) explorer?.view?.revealInFolder?.(file.parent);
        return true;
      },
    });

    this.addCommand({
      id: "open-first-child",
      name: "Open the first child file",
      checkCallback: (checking) => {
        const file = this.activeFile();
        if (!file || !isEligible(this, file)) return false;
        const children = (file.parent as unknown as { children?: TFile[] } | null)?.children;
        if (!children || children.length === 0) return false;
        if (checking) return true;

        const child = children[0];
        const explorer = this.app.workspace.getLeavesOfType("file-explorer")[0] as
          | { view?: { revealInFolder?: (t: unknown) => void } }
          | undefined;
        if (child instanceof TFile) {
          this.app.workspace.openLinkText(child.path, "", false);
        } else {
          explorer?.view?.revealInFolder?.(child);
        }
        return true;
      },
    });

    // ── Setting tab ──
    this.addSettingTab(new HierarchyNavigatorSettingTab(this.app, this));
    console.log(`${PLUGIN_NAME}: loaded`);
  }

  onunload(): void {
    console.log(`${PLUGIN_NAME}: unloaded`);
    // Defensive: drop our DOM from any view that still has it, so
    // reloading the plugin doesn't accumulate duplicates if hot-reload
    // doesn't fully reinstantiate Obsidian's view tree.
    this.iterateMarkdownViews((view) => {
      view.contentEl.querySelectorAll(`.${BLOCK_CLASS}`).forEach((n) => n.remove());
    });
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** Re-render the block everywhere so a settings change is visible at once. */
  refresh(): void {
    this.syncAllOpenLeaves();
  }

  get looseApp(): AnyApp {
    return this.app as AnyApp;
  }

  /* ────────────────────────────────────────────────
     Mounting helpers
     ──────────────────────────────────────────────── */

  private activeFile(): TFile | null {
    const f = this.app.workspace.getActiveFile();
    return f instanceof TFile ? f : null;
  }

  /** Mount (or refresh) the block in the given leaf's markdown view. */
  private mountInto(leaf: WorkspaceLeaf): void {
    const view = leaf.view;
    if (!(view instanceof MarkdownView)) return;

    const file = view.file;
    if (!(file instanceof TFile)) return;

    // Eligibility check first — if the note opted out, *remove* any
    // stale block from a previous mount.
    if (!isEligible(this, file)) {
      view.contentEl.querySelectorAll(`.${BLOCK_CLASS}`).forEach((n) => n.remove());
      return;
    }

    // Always start clean: there's at most ONE block per view, period.
    view.contentEl.querySelectorAll(`.${BLOCK_CLASS}`).forEach((n) => n.remove());

    const block = renderHierarchyBlock(this, file);

    {
      // The block sits directly below the note's large title, not above it.
      // Prefer the rendered H1, then Obsidian's inline-title fallback.
      // This keeps the hierarchy chrome attached to the document title
      // while leaving Properties and the body in their natural order.
      const title = view.contentEl.querySelector<HTMLElement>(
        ".inline-title, :scope h1",
      );
      if (title) {
        // Properties sit in the document flow in both reading and editing
        // (Live Preview / Source) views: place the block just above them,
        // which keeps the order title → navigation → properties → body.
        const metadata = view.contentEl.querySelector<HTMLElement>(
          ".metadata-container, .metadata-properties",
        );
        if (metadata?.parentElement) {
          metadata.parentElement.insertBefore(block, metadata);
          return;
        }

        // Editor without properties: sit directly before the editable
        // content inside the editor sizer.
        const sizer = title.closest<HTMLElement>(".cm-sizer");
        const cmContent = sizer?.querySelector<HTMLElement>(
          ":scope > .cm-contentContainer",
        );
        if (sizer && cmContent) {
          sizer.insertBefore(block, cmContent);
          return;
        }

        // Reading view without properties: after the title's top-level row.
        // In some themes the title is inside a horizontal grid/flex row;
        // inserting beside the title node would put Hierarchy in the row's
        // right column, so walk up to the row first.
        const contentRoot =
          title.closest<HTMLElement>(".markdown-preview-sizer") ??
          view.contentEl;
        let titleRow = title;
        while (titleRow.parentElement && titleRow.parentElement !== contentRoot) {
          titleRow = titleRow.parentElement;
        }
        titleRow.insertAdjacentElement("afterend", block);
      } else {
        // The title is rendered asynchronously on first open. Give Obsidian
        // one frame to add it before choosing a fallback insertion point.
        if (!this.pendingTitleRetries.has(leaf)) {
          this.pendingTitleRetries.add(leaf);
          window.requestAnimationFrame(() => {
            this.pendingTitleRetries.delete(leaf);
            if (view.file === file) {
              this.mountInto(leaf);
            }
          });
          return;
        }

        // Some themes hide the inline title entirely. Keep the navigation
        // before Properties (or before the editor content) without putting
        // it ahead of a title rendered later in the same view.
        const fallbackSizer = view.contentEl.querySelector<HTMLElement>(".cm-sizer");
        const fallbackContent = fallbackSizer?.querySelector<HTMLElement>(
          ":scope > .cm-contentContainer",
        );
        if (fallbackSizer && fallbackContent) {
          fallbackSizer.insertBefore(block, fallbackContent);
          return;
        }
        const contentRoot =
          view.contentEl.querySelector<HTMLElement>(".markdown-preview-sizer") ??
          view.contentEl;
        const firstContent = contentRoot.querySelector<HTMLElement>(
          ":scope > :not(.hn-root)",
        );
        if (firstContent) {
          contentRoot.insertBefore(block, firstContent);
        } else {
          contentRoot.appendChild(block);
        }
      }
    }
  }

  /** Walk every markdown leaf and (re-)mount if it's a preview leaf. */
  private syncAllOpenLeaves(): void {
    this.iterateMarkdownViews((view) => this.mountInto(view.leaf));
  }

  /** Refresh the active leaf — used when settings change in-flight. */
  private syncActiveLeaf(): void {
    const leaf = this.app.workspace.activeLeaf;
    if (leaf) this.mountInto(leaf);
  }

  private iterateMarkdownViews(fn: (view: MarkdownView) => void): void {
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf instanceof View && "getMode" in leaf.view) {
        // no-op — guard to keep TS happy on runtime duck-typing
      }
      const view = leaf.view;
      if (view instanceof MarkdownView) fn(view);
    });
  }
}
