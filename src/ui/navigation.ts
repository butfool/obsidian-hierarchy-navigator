import { TFile, TFolder } from "obsidian";
import type HierarchyNavigator from "../main";

/** Open a file or reveal a folder using Obsidian's native workspace surfaces. */
export function openTarget(
  plugin: HierarchyNavigator,
  target: TFile | TFolder,
): void {
  if (target instanceof TFile) {
    void plugin.app.workspace.openLinkText(target.path, "", false);
    return;
  }
  const explorer = plugin.app.workspace.getLeavesOfType("file-explorer")[0];
  const view = (explorer as {
    view?: { revealInFolder?: (target: unknown) => void };
  } | undefined)?.view;
  view?.revealInFolder?.(target);
}
