import {
  Plugin,
  TFile,
  MarkdownView,
  WorkspaceLeaf,
  View,
  type Command,
} from "obsidian";
import {
  DEFAULT_SETTINGS,
  HierarchyNavigatorSettings,
  AnyApp,
  HierarchyNavigatorPlugin,
} from "./types";
import { getStrings } from "./i18n";
import { HierarchyNavigatorSettingTab } from "./settingTab";
import {
  renderHierarchyBlock,
  renderBodyIndex,
  isNoteBodyEmpty,
  isRawBodyEmpty,
  refitSections,
  isEligible,
  chromeBottom,
  BLOCK_CLASS,
  CHROME_SELECTOR,
  INDEX_CLASS,
  OWNED_SELECTOR,
} from "./renderer";

const PLUGIN_NAME = "Hierarchy Navigator";

export default class HierarchyNavigator
  extends Plugin
  implements HierarchyNavigatorPlugin
{
  public settings: HierarchyNavigatorSettings;
  private pendingTitleRetries = new WeakSet<WorkspaceLeaf>();
  /** Command-registry entries, kept so their names can follow the language. */
  private revealParentCommand: Command | null = null;
  private openFirstChildCommand: Command | null = null;

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

    // Belt and braces for the reading/editing split: if an overlay ever
    // survives a mode switch (no `layout-change`), clicking into the editor
    // still clears it. The overlay must never sit over the caret.
    this.registerDomEvent(document, "focusin", (ev) => {
      const target = ev.target as HTMLElement | null;
      if (!target?.closest?.(".cm-editor")) return;
      const pane = target.closest<HTMLElement>(".workspace-leaf-content");
      const overlay = pane?.querySelector<HTMLElement>(`.${INDEX_CLASS}`);
      if (!overlay) return;
      this.indexObservers.get(overlay)?.disconnect();
      this.indexObservers.delete(overlay);
      overlay.remove();
    });

    // Initial mount for the leaf already open at plugin load time.
    this.syncAllOpenLeaves();

    // ── Commands ──
    // The returned objects are the live entries in the command registry, so
    // `localizeCommands` can retitle them in place when the language changes
    // — no reload, no re-registration.
    this.revealParentCommand = this.addCommand({
      id: "reveal-parent",
      name: getStrings(this.settings.language).revealParentCommand,
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

    this.openFirstChildCommand = this.addCommand({
      id: "open-first-child",
      name: getStrings(this.settings.language).openFirstChildCommand,
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
      this.removeOwned(view.contentEl);
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
    this.localizeCommands();
    this.syncAllOpenLeaves();
  }

  /**
   * Retitle the registered commands in the current language. Command names
   * live in Obsidian's own registry (the command palette, the hotkey list),
   * not in our DOM, so a language change has to reach them explicitly.
   */
  private localizeCommands(): void {
    const t = getStrings(this.settings.language);
    if (this.revealParentCommand) {
      this.revealParentCommand.name = t.revealParentCommand;
    }
    if (this.openFirstChildCommand) {
      this.openFirstChildCommand.name = t.openFirstChildCommand;
    }
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
      this.removeOwned(view.contentEl);
      return;
    }

    // Always start clean: there's at most ONE block per view, period.
    this.removeOwned(view.contentEl);

    const block = renderHierarchyBlock(this, file);

    // The block sits directly below the note's large title, not above it.
    // Prefer the rendered H1, then Obsidian's inline-title fallback. This
    // keeps the hierarchy chrome attached to the document title while leaving
    // Properties and the body in their natural order.
    //
    // Returns false only when nothing was placed because the title has not
    // rendered yet; the caller then retries on the next frame.
    const placeChrome = (): boolean => {
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
        const metadataParent = metadata?.parentElement;
        if (metadata && metadataParent) {
          metadataParent.insertBefore(block, metadata);
          return true;
        }

        // Editor without properties: sit directly before the editable
        // content inside the editor sizer.
        const sizer = title.closest<HTMLElement>(".cm-sizer");
        const cmContent = sizer?.querySelector<HTMLElement>(
          ":scope > .cm-contentContainer",
        );
        if (sizer && cmContent) {
          sizer.insertBefore(block, cmContent);
          return true;
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
        return true;
      }

      // The title is rendered asynchronously on first open. Give Obsidian one
      // frame to add it before choosing a fallback insertion point.
      if (!this.pendingTitleRetries.has(leaf)) {
        this.pendingTitleRetries.add(leaf);
        window.requestAnimationFrame(() => {
          this.pendingTitleRetries.delete(leaf);
          if (view.file === file) {
            this.mountInto(leaf);
          }
        });
        return false;
      }

      // Some themes hide the inline title entirely. Keep the navigation
      // before Properties (or before the editor content) without putting it
      // ahead of a title rendered later in the same view.
      const fallbackSizer = view.contentEl.querySelector<HTMLElement>(".cm-sizer");
      const fallbackContent = fallbackSizer?.querySelector<HTMLElement>(
        ":scope > .cm-contentContainer",
      );
      if (fallbackSizer && fallbackContent) {
        fallbackSizer.insertBefore(block, fallbackContent);
        return true;
      }
      const contentRoot =
        view.contentEl.querySelector<HTMLElement>(".markdown-preview-sizer") ??
        view.contentEl;
      const firstContent = contentRoot.querySelector<HTMLElement>(
        ":scope > :not(.hn-root):not(.hn-index)",
      );
      if (firstContent) {
        contentRoot.insertBefore(block, firstContent);
      } else {
        contentRoot.appendChild(block);
      }
      return true;
    };

    if (!placeChrome()) return;

    // The body index is an overlay over the note body rather than a node in
    // it: nothing reflows when it appears, and nothing moves when it leaves.
    this.mountBodyIndex(view, file);
  }

  /* ────────────────────────────────────────────────
     Body index overlay
     ──────────────────────────────────────────────── */

  /** Overlays that follow their header block's height. */
  private indexObservers = new WeakMap<HTMLElement, ResizeObserver>();

  /**
   * Mount the body index, but only while the note body is empty. An overlay
   * over a note that *has* a body would hide the thing the user came to read.
   */
  private mountBodyIndex(view: MarkdownView, file: TFile): void {
    // Reading mode only. An overlay is for a page you are *looking* at: put it
    // over the editor and it covers what you are writing, so editing mode
    // simply never gets one.
    if (view.getMode() !== "preview") return;

    const empty = isNoteBodyEmpty(this, file);
    if (empty === false) return;
    if (empty === true) {
      this.attachBodyIndex(view, file);
      return;
    }
    // Metadata cache not built yet — brand-new notes land here. Read the text
    // rather than guessing: a wrong "empty" drops a panel over real writing,
    // and a wrong "not empty" silently loses the launcher on a blank page.
    void this.app.vault.cachedRead(file).then((text) => {
      if (view.file !== file) return;
      if (!isRawBodyEmpty(text)) return;
      this.attachBodyIndex(view, file);
    });
  }

  /** Build the overlay, hang it in the pane, and keep it under the chrome. */
  private attachBodyIndex(view: MarkdownView, file: TFile): void {
    const overlay = renderBodyIndex(this, file);
    if (!overlay) return;

    const host = view.contentEl;
    // The overlay is positioned against the pane, not the document.
    if (getComputedStyle(host).position === "static") {
      host.style.position = "relative";
    }
    host.appendChild(overlay);

    const fit = () => {
      if (!overlay.isConnected) return;
      // Anchor below everything the note already shows above its body — the
      // navigation block *and* the Properties block. Properties are the note's
      // own content; the overlay is opaque, so starting at the navigation
      // block would hide them. Falls back to a fixed offset when nothing is
      // measurable yet, so a missing header block can never make the overlay
      // cover the title.
      const anchor = chromeBottom(host);
      const top =
        anchor === null ? 120 : anchor - host.getBoundingClientRect().top;
      overlay.style.setProperty("top", `${Math.max(0, Math.round(top)) + 14}px`);
    };
    fit();
    window.requestAnimationFrame(fit);

    // Folding a section, resizing the pane, letting the chips wrap, or
    // expanding the Properties block all change how tall the chrome is — the
    // overlay has to follow every one of them.
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(fit);
      host
        .querySelectorAll<HTMLElement>(CHROME_SELECTOR)
        .forEach((node) => observer.observe(node));
      this.indexObservers.set(overlay, observer);
    }
  }

  /** Remove everything this plugin owns in a container, observers included. */
  private removeOwned(host: HTMLElement): void {
    host.querySelectorAll<HTMLElement>(OWNED_SELECTOR).forEach((node) => {
      this.indexObservers.get(node)?.disconnect();
      this.indexObservers.delete(node);
      node.remove();
    });
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
