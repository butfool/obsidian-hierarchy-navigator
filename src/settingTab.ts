import { App, PluginSettingTab, Setting } from "obsidian";
import type { HierarchyNavigatorPlugin, Locale } from "./types";
import { getStrings, LANGUAGES } from "./i18n";

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

    // Every label on this page comes from the same language table the block
    // itself uses, so the tab is in whatever language the plugin is set to.
    const t = getStrings(this.plugin.settings.language).settings;

    containerEl.createEl("h2", { text: "Hierarchy Navigator" });
    containerEl.createEl("p", { text: t.intro });

    // Language first: it is the setting that decides how this very page reads,
    // so changing it re-renders the tab on the spot.
    new Setting(containerEl)
      .setName(t.languageName)
      .setDesc(t.languageDesc)
      .addDropdown((d) => {
        for (const { value, label } of LANGUAGES) d.addOption(value, label);
        d.setValue(this.plugin.settings.language);
        d.onChange(async (v) => {
          this.plugin.settings.language = v as Locale;
          await this.persist();
          this.display();
        });
      });

    new Setting(containerEl)
      .setName(t.headerLabelName)
      .setDesc(t.headerLabelDesc)
      .addText((txt) => {
        txt.setValue(this.plugin.settings.headerTitle);
        txt.onChange(async (v) => {
          this.plugin.settings.headerTitle = v.trim();
          await this.persist();
        });
      });

    /* ── Sections ── */
    containerEl.createEl("h3", { text: t.sectionsHeading });

    new Setting(containerEl)
      .setName(t.showParentName)
      .setDesc(t.showParentDesc)
      .addToggle((tg) => {
        tg.setValue(this.plugin.settings.showParent);
        tg.onChange(async (v) => {
          this.plugin.settings.showParent = v;
          await this.persist();
        });
      });

    new Setting(containerEl)
      .setName(t.showSiblingsName)
      .setDesc(t.showSiblingsDesc)
      .addToggle((tg) => {
        tg.setValue(this.plugin.settings.showSiblings);
        tg.onChange(async (v) => {
          this.plugin.settings.showSiblings = v;
          await this.persist();
        });
      });

    new Setting(containerEl)
      .setName(t.showFoldersName)
      .setDesc(t.showFoldersDesc)
      .addToggle((tg) => {
        tg.setValue(this.plugin.settings.showFolders);
        tg.onChange(async (v) => {
          this.plugin.settings.showFolders = v;
          await this.persist();
        });
      });

    new Setting(containerEl)
      .setName(t.showFilesName)
      .setDesc(t.showFilesDesc)
      .addToggle((tg) => {
        tg.setValue(this.plugin.settings.showFiles);
        tg.onChange(async (v) => {
          this.plugin.settings.showFiles = v;
          await this.persist();
        });
      });

    /* ── Layout ── */
    containerEl.createEl("h3", { text: t.layoutHeading });

    new Setting(containerEl)
      .setName(t.sectionLayoutName)
      .setDesc(t.sectionLayoutDesc)
      .addDropdown((d) => {
        d.addOption("single-line", t.sectionLayoutSingle);
        d.addOption("wrap", t.sectionLayoutWrap);
        d.setValue(this.plugin.settings.sectionLayout);
        d.onChange(async (v) => {
          this.plugin.settings.sectionLayout = v as "single-line" | "wrap";
          await this.persist();
        });
      });

    new Setting(containerEl)
      .setName(t.maxItemsName)
      .setDesc(t.maxItemsDesc)
      .addText((txt) => {
        txt.inputEl.type = "number";
        txt.inputEl.min = "1";
        txt.setValue(String(this.plugin.settings.maxVisibleItems));
        txt.onChange(async (v) => {
          const n = Number.parseInt(v, 10);
          if (!Number.isFinite(n) || n < 1) return;
          this.plugin.settings.maxVisibleItems = n;
          await this.persist();
        });
      });

    /* ── Body index ── */
    containerEl.createEl("h3", { text: t.bodyIndexHeading });

    new Setting(containerEl)
      .setName(t.showBodyIndexName)
      .setDesc(t.showBodyIndexDesc)
      .addToggle((tg) => {
        tg.setValue(this.plugin.settings.showBodyIndex);
        tg.onChange(async (v) => {
          this.plugin.settings.showBodyIndex = v;
          await this.persist();
        });
      });

    /* ── Tips ── */
    containerEl.createEl("h3", { text: t.tipsHeading });
    containerEl.createEl("p", { text: t.tips });
  }
}
