import { z } from "zod";
import { DEFAULT_SETTINGS, type HierarchyNavigatorSettings } from "./types";

const settingsSchema = z.object({
  language: z.enum(["zh", "en"]).default(DEFAULT_SETTINGS.language),
  headerTitle: z.string().default(DEFAULT_SETTINGS.headerTitle),
  showParent: z.boolean().default(DEFAULT_SETTINGS.showParent),
  showFolders: z.boolean().default(DEFAULT_SETTINGS.showFolders),
  showFiles: z.boolean().default(DEFAULT_SETTINGS.showFiles),
  showSiblings: z.boolean().default(DEFAULT_SETTINGS.showSiblings),
  showBodyIndex: z.boolean().default(DEFAULT_SETTINGS.showBodyIndex),
  enableCreate: z.boolean().default(DEFAULT_SETTINGS.enableCreate),
  sectionLayout: z.enum(["single-line", "wrap"]).default(DEFAULT_SETTINGS.sectionLayout),
  maxVisibleItems: z.number().int().positive().default(DEFAULT_SETTINGS.maxVisibleItems),
  collapsed: z.boolean().default(DEFAULT_SETTINGS.collapsed),
});

/** Missing saved settings use defaults; invalid values stop plugin loading. */
export function parseSettings(data: unknown): HierarchyNavigatorSettings {
  return settingsSchema.parse(data ?? {});
}
