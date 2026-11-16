import {
  Plugin,
  TFile,
  TAbstractFile,
  MarkdownView,
  WorkspaceLeaf,
  type Command,
} from "obsidian";
import { parseSettings } from "./settings";
import {
  HierarchyNavigatorSettings,
  AnyApp,
  HierarchyNavigatorPlugin,
} from "./types";
import { getStrings } from "./i18n";
import { HierarchyNavigatorSettingTab } from "./settingTab";
import {
  renderHierarchyBlock,
  refitSections,
  BLOCK_CLASS,
  INDEX_CLASS,
  OWNED_SELECTOR,
  PROPERTIES_SELECTOR,
  destroyOwnedElement,
} from "./renderer";
import { renderBodyIndex, isNoteBodyEmpty, isRawBodyEmpty } from "./views/body-index";
import { getChildrenForFile, isEligible } from "./hierarchy";


interface MountState {
  file: TFile;
  block: HTMLElement | null;
  frameId: number | null;
  reanchorFrameId: number | null;
  settleTimer: number | null;
  titleRetryUsed: boolean;
  disposed: boolean;
  unwatchScroll: (() => void) | null;
}

interface Anchor {
  parent: HTMLElement;
  ref: HTMLElement;
  before: boolean;
}

export default class HierarchyNavigator
  extends Plugin
  implements HierarchyNavigatorPlugin
{
  public settings: HierarchyNavigatorSettings;
  /** Command-registry entries, kept so their names can follow the language. */
  private revealParentCommand: Command | null = null;
  private openFirstChildCommand: Command | null = null;
  private readonly mounts = new Map<MarkdownView, MountState>();
  private readonly pendingRefreshPaths = new Set<string>();
  private refreshTimer: number | null = null;
  private alive = true;

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
        if (leaf) this.mountInto(leaf);
      }),
    );

    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.syncAllOpenLeaves()),
    );

    this.registerEvent(
      this.app.workspace.on("file-open", () => this.syncActiveLeaf()),
    );

    this.registerEvent(
      this.app.vault.on("create", (file) =>
        this.scheduleRefresh(file.path, this.parentPath(file.path)),
      ),
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) =>
        this.scheduleRefresh(file.path, this.parentPath(file.path)),
      ),
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) =>
        this.scheduleRefresh(file.path, this.parentPath(file.path)),
      ),
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) =>
        this.scheduleRefresh(
          file.path,
          oldPath,
          this.parentPath(file.path),
          this.parentPath(oldPath),
        ),
      ),
    );
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) =>
        this.scheduleRefresh(file.path, this.parentPath(file.path)),
      ),
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

    // Belt and braces for the reading/editing split: if the index ever
    // survives a mode switch (no `layout-change`), clicking into the editor
    // still clears it. Keeping it would put launcher rows above the caret.
    this.registerDomEvent(document, "focusin", (ev) => {
      const target = ev.target as HTMLElement | null;
      if (!target?.closest?.(".cm-editor")) return;
      const pane = target.closest<HTMLElement>(".workspace-leaf-content");
      pane?.querySelector<HTMLElement>(`.${INDEX_CLASS}`)?.remove();
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
          | { view?: { revealInFolder?: (file: TAbstractFile) => void } }
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
        const children = getChildrenForFile(this, file);
        if (!children || children.length === 0) return false;
        if (checking) return true;

        const child = children[0];
        const explorer = this.app.workspace.getLeavesOfType("file-explorer")[0] as
          | { view?: { revealInFolder?: (file: TAbstractFile) => void } }
          | undefined;
        if (child instanceof TFile) {
          void this.app.workspace.openLinkText(child.path, "", false);
        } else {
          explorer?.view?.revealInFolder?.(child);
        }
        return true;
      },
    });

    // ── Setting tab ──
    this.addSettingTab(new HierarchyNavigatorSettingTab(this.app, this));
  }

  onunload(): void {
    this.alive = false;
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.pendingRefreshPaths.clear();
    // Defensive: drop our DOM from any view that still has it, so
    // reloading the plugin doesn't accumulate duplicates if hot-reload
    // doesn't fully reinstantiate Obsidian's view tree.
    for (const view of this.mounts.keys()) this.disposeMount(view);
    this.iterateMarkdownViews((view) => this.removeOwned(view.contentEl));
  }

  async loadSettings(): Promise<void> {
    const data: unknown = await this.loadData();
    this.settings = parseSettings(data);
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

  /**
   * Mount (or refresh) the block in the given leaf's markdown view.
   *
   * `titleRetryUsed` marks the second attempt of a mount that had no resolvable
   * insertion point yet: the title is rendered asynchronously on first open, so
   * the first attempt waits one frame for it, and the second places the block in
   * the note header. Without that ceiling, a view that never renders a title
   * would rebuild its block once per frame, forever.
   */
  private mountInto(leaf: WorkspaceLeaf, existing?: MountState): void {
    const view = leaf.view;
    if (!(view instanceof MarkdownView)) return;

    const file = view.file;
    if (!(file instanceof TFile)) return;

    const current = existing ?? this.mounts.get(view);
    const state = current && current.file === file
      ? current
      : this.beginMount(view, file);
    if (!this.isCurrentMount(view, state)) return;
    if (existing === undefined && state.frameId !== null) {
      window.cancelAnimationFrame(state.frameId);
      state.frameId = null;
    }

    // Eligibility check first — if the note opted out, *remove* any
    // stale block from a previous mount.
    if (!isEligible(this, file)) {
      this.disposeMount(view);
      return;
    }

    // Reuse the tracked node on a retry. Every other mount rebuilds the
    // content but keeps the node's document position.
    const previous = state.block;
    const block = previous !== null && existing !== undefined
      ? previous
      : renderHierarchyBlock(this, file);
    state.block = block;

    const placed = this.placeChrome(view, block, previous);
    if (!placed && previous === null && !state.titleRetryUsed) {
      // The title is rendered asynchronously on first open. Give Obsidian one
      // frame to add it before placing the block in the note header.
      state.titleRetryUsed = true;
      state.frameId = window.requestAnimationFrame(() => {
        state.frameId = null;
        if (view.file === file && this.isCurrentMount(view, state)) {
          this.mountInto(leaf, state);
        }
      });
      return;
    }
    if (!placed) this.placeInHeader(view, block);

    if (previous && previous !== block) {
      destroyOwnedElement(previous);
      previous.remove();
    }
    // A stale copy can come back with the note header when Obsidian reattaches
    // the detached title subtree; keep exactly one block per view.
    view.contentEl.querySelectorAll<HTMLElement>(`.${BLOCK_CLASS}`).forEach((node) => {
      if (node === block) return;
      destroyOwnedElement(node);
      node.remove();
    });

    this.watchScroll(view, state);
    this.settle(view, state);

    // The index is a node in the note, placed directly under the header rail
    // by `attachBodyIndex`: it scrolls with the text like any other block.
    this.mountBodyIndex(view, file, state);
  }

  /**
   * Put the block where the note shows its title: above Properties when the
   * note has them, otherwise directly before the editable content or after the
   * reading view's title row.
   *
   * Returns false when the title area is not in the view. Reading mode unloads
   * the sections above the viewport, so a note scrolled down has body headings
   * rendered while the title subtree is detached. `previous` then carries the
   * position: the block is restored inside that detached subtree and returns
   * together with it.
   */
  private placeChrome(
    view: MarkdownView,
    block: HTMLElement,
    previous: HTMLElement | null,
  ): boolean {
    const anchor = this.resolveAnchor(view);
    if (anchor) {
      if (anchor.before) anchor.parent.insertBefore(block, anchor.ref);
      else anchor.ref.insertAdjacentElement("afterend", block);
      return true;
    }
    if (previous?.parentElement) {
      previous.parentElement.insertBefore(block, previous);
      return true;
    }
    return false;
  }

  /**
   * Resolve the insertion point for the block.
   *
   * The note title is `.inline-title` and nothing else. Body `h1` headings are
   * content: anchoring to them put the block under whichever heading happened
   * to be rendered after the title scrolled out of the reading view.
   */
  private resolveAnchor(view: MarkdownView): Anchor | null {
    const host = this.activeRoot(view);
    const outsideEmbeds = (node: HTMLElement) =>
      !node.closest(".markdown-embed, .internal-embed");

    // Properties sit in the document flow in both reading and editing
    // (Live Preview / Source) views: placing the block just above them keeps
    // the order title → navigation → properties → body.
    const metadata = Array.from(
      host.querySelectorAll<HTMLElement>(PROPERTIES_SELECTOR),
    ).find(outsideEmbeds);
    if (metadata?.parentElement) {
      return { parent: metadata.parentElement, ref: metadata, before: true };
    }

    // Editor without properties: sit directly before the editable content
    // inside the editor sizer.
    const sizer = host.querySelector<HTMLElement>(".cm-sizer");
    const cmContent = sizer?.querySelector<HTMLElement>(
      ":scope > .cm-contentContainer",
    );
    if (sizer && cmContent) {
      return { parent: sizer, ref: cmContent, before: true };
    }

    // Reading view without properties: after the title's top-level row.
    // In some themes the title is inside a horizontal grid/flex row;
    // inserting beside the title node would put Hierarchy in the row's right
    // column, so walk up to the row first.
    const title = Array.from(
      host.querySelectorAll<HTMLElement>(".inline-title"),
    ).find(outsideEmbeds);
    if (!title) return null;
    const contentRoot =
      title.closest<HTMLElement>(".markdown-preview-sizer") ?? host;
    let titleRow = title;
    while (titleRow.parentElement && titleRow.parentElement !== contentRoot) {
      titleRow = titleRow.parentElement;
    }
    return { parent: contentRoot, ref: titleRow, before: false };
  }

  /**
   * Reading mode with neither a title nor Properties rendered: the block still
   * belongs above the text, inside the header Obsidian renders with the note.
   * When the header itself is unloaded because the note is scrolled past it,
   * the block stays out of the document and the scroll watcher anchors it once
   * the header is rendered again.
   */
  private placeInHeader(view: MarkdownView, block: HTMLElement): void {
    const header = this.activeRoot(view).querySelector<HTMLElement>(
      ".mod-header",
    );
    if (header) header.insertBefore(block, header.firstElementChild);
  }

  /**
   * The container of what the user is looking at. A markdown leaf keeps both
   * its reading view and its (hidden) source view in the DOM, so a query
   * across `contentEl` would anchor to the mode that is not on screen.
   */
  private activeRoot(view: MarkdownView): HTMLElement {
    const preview = view.contentEl.querySelector<HTMLElement>(".markdown-reading-view");
    const source = view.contentEl.querySelector<HTMLElement>(".markdown-source-view");
    const primary = view.getMode() === "preview" ? preview : source;
    const secondary = primary === preview ? source : preview;
    if (primary && primary.getClientRects().length > 0) return primary;
    if (secondary && secondary.getClientRects().length > 0) return secondary;
    return primary ?? secondary ?? view.contentEl;
  }

  private isAtAnchor(block: HTMLElement, anchor: Anchor): boolean {
    if (block.parentElement !== anchor.parent) return false;
    return anchor.before
      ? block.nextElementSibling === anchor.ref
      : block.previousElementSibling === anchor.ref;
  }

  /**
   * Re-anchor the block when the document around it settles.
   *
   * Obsidian renders parts of the view asynchronously: the note title on first
   * open, Properties after a mode switch, and the sections above the reading
   * viewport while scrolling. A block placed before those exist would stay in
   * the wrong spot, so scrolling and a short delay after each mount re-check
   * the anchor.
   */
  private watchScroll(view: MarkdownView, state: MountState): void {
    if (state.unwatchScroll) return;
    const onScroll = () => this.requestReanchor(view);
    view.contentEl.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    state.unwatchScroll = () => {
      view.contentEl.removeEventListener("scroll", onScroll, true);
    };
  }

  private settle(view: MarkdownView, state: MountState): void {
    this.requestReanchor(view);
    if (state.settleTimer !== null) window.clearTimeout(state.settleTimer);
    state.settleTimer = window.setTimeout(() => {
      state.settleTimer = null;
      this.requestReanchor(view);
    }, 250);
  }

  private requestReanchor(view: MarkdownView): void {
    const state = this.mounts.get(view);
    if (!state || state.reanchorFrameId !== null) return;
    state.reanchorFrameId = window.requestAnimationFrame(() => {
      state.reanchorFrameId = null;
      if (!this.isCurrentMount(view, state)) return;
      const block = state.block;
      // A block inside a detached subtree already holds its document position;
      // it returns together with that subtree. Only a block with no parent at
      // all is waiting for a place.
      if (!block) return;
      if (block.parentElement && !block.isConnected) return;
      const anchor = this.resolveAnchor(view);
      if (!anchor) {
        if (!block.parentElement) this.placeInHeader(view, block);
        return;
      }
      if (block.parentElement && this.isAtAnchor(block, anchor)) return;
      if (anchor.before) anchor.parent.insertBefore(block, anchor.ref);
      else anchor.ref.insertAdjacentElement("afterend", block);
    });
  }

  /* ────────────────────────────────────────────────
     Body index
     ──────────────────────────────────────────────── */

  /**
   * Mount the body index, but only while the note body is empty: it is a
   * launcher for a page that has nothing on it yet, and on a note that already
   * has a body it would only be one more thing to scroll past.
   */
  private mountBodyIndex(view: MarkdownView, file: TFile, state: MountState): void {
    // Reading mode only. A launcher is for a page you are *looking* at: in the
    // editor it would sit between you and the text you are writing, so editing
    // mode simply never gets one.
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
      if (!this.isCurrentMount(view, state)) return;
      if (view.file !== file || view.getMode() !== "preview") return;
      if (!isRawBodyEmpty(text)) return;
      this.attachBodyIndex(view, file);
    }).catch(() => {
      // A cache read can fail while a file is being renamed or deleted. The
      // navigation block remains useful, but there is no safe index to add.
    });
  }

  /**
   * Build the index and put it in the document, directly under whatever the
   * note shows above its body: the Properties block when it has one, our
   * header rail when it does not. Living in the note rather than over the pane
   * is what makes it scroll with the text and inherit the reading column's
   * width — and it is safe precisely because the index only exists on an empty
   * body: there is nothing below it to displace.
   */
  private attachBodyIndex(view: MarkdownView, file: TFile): void {
    if (view.getMode() !== "preview") return;
    view.contentEl.querySelectorAll<HTMLElement>(`.${INDEX_CLASS}`).forEach((node) => {
      destroyOwnedElement(node);
      node.remove();
    });
    const index = renderBodyIndex(this, file);
    if (!index) return;

    // The index sits under the block, so it needs a block in the document. A
    // view restored while scrolled past the header has none until the block is
    // anchored again; the index would be stranded at the end of the note.
    const rail = this.activeRoot(view).querySelector<HTMLElement>(
      `.${BLOCK_CLASS}`,
    );
    if (!rail) return;
    const anchor = this.bodyAnchor(this.activeRoot(view), rail);
    if (anchor?.parentElement) {
      anchor.insertAdjacentElement("afterend", index);
      return;
    }

    // Nothing to sit under (a theme hid both the title and Properties, or the
    // two mounts raced): fall back to the end of the reading column.
    const sizer =
      this.activeRoot(view).querySelector<HTMLElement>(".markdown-preview-sizer") ??
      view.contentEl;
    sizer.appendChild(index);
  }

  /**
   * The bottom-most thing the note shows above its body — Properties when the
   * note has them, the header rail when it does not. The rail is mounted
   * *above* Properties, so anchoring to the rail would push the note's own
   * frontmatter below the list; anchoring to Properties keeps the document in
   * its natural order.
   */
  private bodyAnchor(
    host: HTMLElement,
    rail: HTMLElement | null,
  ): HTMLElement | null {
    // The note's own Properties block is the one sharing the rail's container:
    // Obsidian renders both in the same reading column.
    const own = Array.from(
      host.querySelectorAll<HTMLElement>(PROPERTIES_SELECTOR),
    ).find((node) =>
      node.parentElement === rail?.parentElement &&
      !node.closest(".markdown-embed, .internal-embed"),
    );
    return own ?? rail;
  }

  /** Remove everything this plugin owns in a container. */
  private removeOwned(host: HTMLElement): void {
    host.querySelectorAll<HTMLElement>(OWNED_SELECTOR).forEach((node) => {
      destroyOwnedElement(node);
      node.remove();
    });
  }

  /** Walk every markdown leaf and (re-)mount if it's a preview leaf. */
  private syncAllOpenLeaves(): void {
    const openViews = new Set<MarkdownView>();
    this.iterateMarkdownViews((view) => {
      openViews.add(view);
      this.mountInto(view.leaf);
    });
    for (const view of this.mounts.keys()) {
      if (!openViews.has(view)) this.disposeMount(view);
    }
  }

  /** Refresh the active leaf — used when settings change in-flight. */
  private syncActiveLeaf(): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view) this.mountInto(view.leaf);
  }

  private iterateMarkdownViews(fn: (view: MarkdownView) => void): void {
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if (view instanceof MarkdownView) fn(view);
    });
  }

  private beginMount(view: MarkdownView, file: TFile): MountState {
    this.disposeMount(view);
    const state: MountState = {
      file,
      block: null,
      frameId: null,
      reanchorFrameId: null,
      settleTimer: null,
      titleRetryUsed: false,
      disposed: false,
      unwatchScroll: null,
    };
    this.mounts.set(view, state);
    return state;
  }

  private isCurrentMount(view: MarkdownView, state: MountState): boolean {
    return this.alive && !state.disposed && this.mounts.get(view) === state;
  }

  private disposeMount(view: MarkdownView): void {
    const state = this.mounts.get(view);
    if (state) {
      state.disposed = true;
      if (state.frameId !== null) window.cancelAnimationFrame(state.frameId);
      state.frameId = null;
      if (state.reanchorFrameId !== null) {
        window.cancelAnimationFrame(state.reanchorFrameId);
      }
      state.reanchorFrameId = null;
      if (state.settleTimer !== null) window.clearTimeout(state.settleTimer);
      state.settleTimer = null;
      state.unwatchScroll?.();
      state.unwatchScroll = null;
      // The block can live in a subtree Obsidian detached from the view, so
      // `contentEl` cannot see it; destroy the tracked node itself.
      if (state.block) {
        destroyOwnedElement(state.block);
        state.block.remove();
        state.block = null;
      }
      this.mounts.delete(view);
    }
    this.removeOwned(view.contentEl);
  }

  private scheduleRefresh(...paths: string[]): void {
    if (!this.alive) return;
    paths.forEach((path) => this.pendingRefreshPaths.add(path));
    if (this.refreshTimer !== null) return;
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      const changedPaths = new Set(this.pendingRefreshPaths);
      this.pendingRefreshPaths.clear();
      this.syncAffectedLeaves(changedPaths);
    }, 50);
  }

  private syncAffectedLeaves(changedPaths: ReadonlySet<string>): void {
    const openViews = new Set<MarkdownView>();
    this.iterateMarkdownViews((view) => {
      openViews.add(view);
      const file = view.file;
      if (!(file instanceof TFile)) return;
      if (
        changedPaths.has(file.path) ||
        (file.parent && changedPaths.has(file.parent.path))
      ) {
        this.mountInto(view.leaf);
      }
    });
    for (const view of this.mounts.keys()) {
      if (!openViews.has(view)) this.disposeMount(view);
    }
  }

  private parentPath(path: string): string {
    const separator = path.lastIndexOf("/");
    return separator <= 0 ? "/" : path.slice(0, separator);
  }
}
