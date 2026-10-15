import { Modal, Notice, Setting, type ButtonComponent, type TFolder } from "obsidian";
import type HierarchyNavigator from "./main";
import { getStrings } from "./i18n";
import { createChild, type CreateKind } from "./create";

/**
 * The dialog behind the body index's create button: pick a note or a folder,
 * type a name, and — for a folder — say whether a FolderNote comes with it.
 *
 * It stays open on anything the vault will not take (empty name, illegal
 * characters, something already there) and says why inline, so the name can
 * be corrected rather than retyped from scratch.
 */
export class CreateChildModal extends Modal {
  private kind: CreateKind = "note";
  private name = "";
  private partialFolder: TFolder | null = null;
  private folderNote: boolean;
  private nameInput: HTMLInputElement | null = null;
  private folderNoteSetting: Setting | null = null;
  private errorEl: HTMLDivElement | null = null;
  private submitButton: ButtonComponent | null = null;
  private busy = false;

  constructor(
    private readonly plugin: HierarchyNavigator,
    private readonly folder: TFolder,
  ) {
    super(plugin.app);
    this.folderNote = plugin.settings.createFolderNote;
  }

  onOpen(): void {
    const t = getStrings(this.plugin.settings.language);
    this.titleEl.setText(t.createTitle(this.folder.name));
    const { contentEl } = this;

    new Setting(contentEl)
      .setName(t.createKindLabel)
      .addDropdown((dropdown) => {
        dropdown.addOption("note", t.createKindNote);
        dropdown.addOption("folder", t.createKindFolder);
        dropdown.setValue(this.kind);
        dropdown.onChange((value) => {
          this.kind = value === "folder" ? "folder" : "note";
          this.syncKind();
        });
      });

    new Setting(contentEl)
      .setName(t.createNameLabel)
      .setDesc(t.createDestination(this.folder.path))
      .addText((text) => {
        this.nameInput = text.inputEl;
        text.setPlaceholder(t.createNamePlaceholder);
        text.onChange((value) => {
          this.name = value;
          this.partialFolder = null;
          this.clearError();
          this.syncKind();
        });
        text.inputEl.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            void this.submit();
          }
        });
      });

    this.folderNoteSetting = new Setting(contentEl)
      .setName(t.createFolderNoteLabel)
      .addToggle((toggle) => {
        toggle.setValue(this.folderNote);
        toggle.onChange((value) => {
          this.folderNote = value;
        });
      });

    this.errorEl = contentEl.createDiv({ cls: "hn-create-error" });
    this.clearError();

    new Setting(contentEl)
      .addButton((button) => {
        this.submitButton = button;
        button.setButtonText(t.createSubmit).setCta();
        button.onClick(() => void this.submit());
      })
      .addButton((button) => {
        button.setButtonText(t.createCancel);
        button.onClick(() => this.close());
      });

    this.syncKind();
    // The dialog exists to be typed into: put the caret there.
    window.setTimeout(() => this.nameInput?.focus(), 0);
  }

  onClose(): void {
    this.contentEl.empty();
  }

  /** The FolderNote checkbox only means something once a folder is coming. */
  private syncKind(): void {
    const setting = this.folderNoteSetting;
    if (!setting) return;
    const t = getStrings(this.plugin.settings.language);
    const name = this.name.trim() || t.createNamePlaceholder;
    setting.setDesc(t.createFolderNoteDesc(name));
    setting.settingEl.toggle(this.kind === "folder");
  }

  private showError(message: string): void {
    if (!this.errorEl) return;
    this.errorEl.setText(message);
    this.errorEl.show();
  }

  private clearError(): void {
    if (!this.errorEl) return;
    this.errorEl.setText("");
    this.errorEl.hide();
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.submitButton?.setDisabled(busy);
  }

  private async submit(): Promise<void> {
    if (this.busy) return;
    const t = getStrings(this.plugin.settings.language);
    this.setBusy(true);

    const result = await createChild(this.plugin, this.folder, {
      kind: this.kind,
      name: this.name,
      folderNote: this.folderNote,
      retryPartialFolder: this.partialFolder ?? undefined,
    });

    if (result.ok) {
      this.close();
      if (result.kind === "note") {
        new Notice(t.createdNote(result.file.basename));
        // Same leaf, like Obsidian's own "New note": you land where you made it.
        await this.plugin.app.workspace.getLeaf(false).openFile(result.file);
      } else {
        new Notice(t.createdFolder(result.folder.name));
        // There is nothing to open, so re-render instead: the new folder is a
        // row in this very index now. Opening its FolderNote would be a
        // surprise — you asked for a folder, not for a note.
        this.plugin.refresh();
      }
      return;
    }

    this.setBusy(false);
    if (result.reason === "exists") this.showError(t.createExists);
    else if (result.reason === "invalid") this.showError(t.createInvalidName);
    else if (result.reason === "partial") {
      this.partialFolder = result.folder ?? null;
      this.plugin.refresh();
      this.showError(t.createPartial(describe(result.error)));
    } else this.showError(t.createFailed(describe(result.error)));
    this.nameInput?.focus();
  }
}

/** Vault errors are usually human-readable already; fall back to a string. */
function describe(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

/** Open the dialog for `folder` — everything the create button does. */
export function promptCreateChild(
  plugin: HierarchyNavigator,
  folder: TFolder,
): void {
  new CreateChildModal(plugin, folder).open();
}
