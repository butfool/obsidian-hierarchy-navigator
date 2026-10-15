import {
  App,
  PluginSettingTab,
  type SettingDefinition,
  type SettingDefinitionItem,
} from "obsidian";
import type { HierarchyNavigatorPlugin } from "./types";
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

  getSettingDefinitions(): SettingDefinitionItem[] {
    const t = getStrings(this.plugin.settings.language).settings;
    const languageOptions = Object.fromEntries(
      LANGUAGES.map(({ value, label }) => [value, label]),
    );
    return [
      {
        type: "group",
        heading: t.sectionsHeading,
        items: [
          {
            name: t.languageName,
            desc: t.languageDesc,
            control: {
              type: "dropdown",
              key: "language",
              options: languageOptions,
              defaultValue: "zh",
            },
          },
          {
            name: t.headerLabelName,
            desc: t.headerLabelDesc,
            control: {
              type: "text",
              key: "headerTitle",
              defaultValue: "Hierarchy",
            },
          },
          this.toggle("showParent", t.showParentName, t.showParentDesc),
          this.toggle("showSiblings", t.showSiblingsName, t.showSiblingsDesc),
          this.toggle("showFolders", t.showFoldersName, t.showFoldersDesc),
          this.toggle("showFiles", t.showFilesName, t.showFilesDesc),
        ],
      },
      {
        type: "group",
        heading: t.layoutHeading,
        items: [
          {
            name: t.sectionLayoutName,
            desc: t.sectionLayoutDesc,
            control: {
              type: "dropdown",
              key: "sectionLayout",
              options: {
                "single-line": t.sectionLayoutSingle,
                wrap: t.sectionLayoutWrap,
              },
              defaultValue: "single-line",
            },
          },
          {
            name: t.maxItemsName,
            desc: t.maxItemsDesc,
            control: {
              type: "number",
              key: "maxVisibleItems",
              min: 1,
              step: 1,
              defaultValue: 6,
            },
          },
        ],
      },
      {
        type: "group",
        heading: t.bodyIndexHeading,
        items: [
          this.toggle("showBodyIndex", t.showBodyIndexName, t.showBodyIndexDesc),
        ],
      },
      {
        type: "group",
        heading: t.createHeading,
        items: [
          this.toggle("enableCreate", t.enableCreateName, t.enableCreateDesc),
          this.toggle(
            "createFolderNote",
            t.createFolderNoteName,
            t.createFolderNoteDesc,
          ),
        ],
      },
    ];
  }

  getControlValue(key: string): unknown {
    switch (key) {
      case "language":
        return this.plugin.settings.language;
      case "headerTitle":
        return this.plugin.settings.headerTitle;
      case "showParent":
      case "showSiblings":
      case "showFolders":
      case "showFiles":
      case "showBodyIndex":
      case "enableCreate":
      case "createFolderNote":
        return this.plugin.settings[key];
      case "sectionLayout":
        return this.plugin.settings.sectionLayout;
      case "maxVisibleItems":
        return this.plugin.settings.maxVisibleItems;
      default:
        return undefined;
    }
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const languageChanged = key === "language" && value !== this.plugin.settings.language;
    switch (key) {
      case "language":
        if (value === "zh" || value === "en") this.plugin.settings.language = value;
        break;
      case "headerTitle":
        if (typeof value === "string") this.plugin.settings.headerTitle = value.trim();
        break;
      case "sectionLayout":
        if (value === "single-line" || value === "wrap") {
          this.plugin.settings.sectionLayout = value;
        }
        break;
      case "maxVisibleItems":
        if (typeof value === "number" && Number.isInteger(value) && value >= 1) {
          this.plugin.settings.maxVisibleItems = value;
        }
        break;
      case "showParent":
      case "showSiblings":
      case "showFolders":
      case "showFiles":
      case "showBodyIndex":
      case "enableCreate":
      case "createFolderNote":
        if (typeof value === "boolean") {
          this.plugin.settings[key] = value;
        }
        break;
    }
    await this.persist();
    if (languageChanged) this.update();
  }

  private toggle(
    key:
      | "showParent"
      | "showSiblings"
      | "showFolders"
      | "showFiles"
      | "showBodyIndex"
      | "enableCreate"
      | "createFolderNote",
    name: string,
    desc: string,
  ): SettingDefinition {
    return {
      name,
      desc,
      control: { type: "toggle", key, defaultValue: true },
    };
  }
}
