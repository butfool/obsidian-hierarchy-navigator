import { App, PluginSettingTab, Setting } from "obsidian";
import type { HierarchyNavigatorPlugin } from "./types";

export class HierarchyNavigatorSettingTab extends PluginSettingTab {
  private plugin: HierarchyNavigatorPlugin;

  constructor(app: App, plugin: HierarchyNavigatorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /** Persist, then re-render — a settings change should be visible at once. */
  private async persist(): Promise<void> {
    await this.plugin.saveSettings();
    this.plugin.refresh();
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Hierarchy Navigator" });
    containerEl.createEl("p", {
      text:
        "Display a parent / siblings / children navigation block at the top of " +
        "any note. Source files are never modified.",
    });

    new Setting(containerEl)
      .setName("Header label")
      .setDesc(
        "Short label shown above the block. Falls back to 'Hierarchy' if empty.",
      )
      .addText((t) => {
        t.setValue(this.plugin.settings.headerTitle);
        t.onChange(async (v) => {
          this.plugin.settings.headerTitle = v.trim();
          await this.persist();
        });
      });

    /* ── Sections ── */
    containerEl.createEl("h3", { text: "Sections" });

    new Setting(containerEl)
      .setName("Show parent folder")
      .setDesc(
        "Render the folder containing this note. At the vault root the " +
          "homepage note (Homepage plugin) is shown instead; the row is " +
          "hidden when neither applies.",
      )
      .addToggle((tg) => {
        tg.setValue(this.plugin.settings.showParent);
        tg.onChange(async (v) => {
          this.plugin.settings.showParent = v;
          await this.persist();
        });
      });

    new Setting(containerEl)
      .setName("Show siblings")
      .setDesc(
        "Render the notes and folders next to the current one. The current " +
          "node — the file itself, or the folder a Folder Note stands for — " +
          "is never listed, since you are already there.",
      )
      .addToggle((tg) => {
        tg.setValue(this.plugin.settings.showSiblings);
        tg.onChange(async (v) => {
          this.plugin.settings.showSiblings = v;
          await this.persist();
        });
      });

    new Setting(containerEl)
      .setName("Show folders")
      .setDesc("Render folder entries, in the children list and the siblings row.")
      .addToggle((tg) => {
        tg.setValue(this.plugin.settings.showFolders);
        tg.onChange(async (v) => {
          this.plugin.settings.showFolders = v;
          await this.persist();
        });
      });

    new Setting(containerEl)
      .setName("Show files")
      .setDesc("Render file entries, in the children list and the siblings row.")
      .addToggle((tg) => {
        tg.setValue(this.plugin.settings.showFiles);
        tg.onChange(async (v) => {
          this.plugin.settings.showFiles = v;
          await this.persist();
        });
      });

    /* ── Layout ── */
    containerEl.createEl("h3", { text: "Layout" });

    new Setting(containerEl)
      .setName("Section layout")
      .setDesc(
        "Single line keeps each section one row tall, so items the row can't " +
          "fit stay hidden behind the “+N” panel. Multiple lines let a " +
          "section use as many rows as its items need.",
      )
      .addDropdown((d) => {
        d.addOption("single-line", "Single line");
        d.addOption("wrap", "Multiple lines");
        d.setValue(this.plugin.settings.sectionLayout);
        d.onChange(async (v) => {
          this.plugin.settings.sectionLayout = v as "single-line" | "wrap";
          await this.persist();
        });
      });

    new Setting(containerEl)
      .setName("Max items per section")
      .setDesc(
        "Most items shown per section; the rest collapse into a “+N” panel. " +
          "In multiple-line layout this caps all rows together. On a single " +
          "line the row may show fewer, because anything that does not fit " +
          "the pane width moves into that same panel instead of being cut off.",
      )
      .addText((t) => {
        t.inputEl.type = "number";
        t.inputEl.min = "1";
        t.setValue(String(this.plugin.settings.maxVisibleItems));
        t.onChange(async (v) => {
          const n = Number.parseInt(v, 10);
          if (!Number.isFinite(n) || n < 1) return;
          this.plugin.settings.maxVisibleItems = n;
          await this.persist();
        });
      });

    /* ── Tips ── */
    containerEl.createEl("h3", { text: "Tips" });
    containerEl.createEl("p", {
      text:
        "Add `hierarchy-nav: hide` to a note's frontmatter to exclude it from " +
        "this plugin entirely.",
    });
  }
}
