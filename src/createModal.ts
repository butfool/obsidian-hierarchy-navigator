import { Modal, Notice, Setting, type ButtonComponent, type TFolder } from "obsidian";
import type HierarchyNavigator from "./main";
import { Icons } from "./icons";
import { getStrings } from "./i18n";
import { createChild, normalizeName, type CreateKind } from "./create";

const CREATE_KINDS: CreateKind[] = ["note", "folder-note", "folder"];

/** Create a child with an explicit type and a live preview of its structure. */
export class CreateChildModal extends Modal {
  private kind: CreateKind = "folder-note";
  private name = "";
  private partialFolder: TFolder | null = null;
  private nameInput!: HTMLInputElement;
  private selector!: HTMLDivElement;
  private kindButtons: HTMLButtonElement[] = [];
  private previewEl!: HTMLElement;
  private errorEl!: HTMLDivElement;
  private submitButton!: ButtonComponent;
  private cancelButton!: ButtonComponent;
  private busy = false;

  constructor(
    private readonly plugin: HierarchyNavigator,
    private readonly folder: TFolder,
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    const t = getStrings(this.plugin.settings.language);
    this.titleEl.setText(t.createTitle(this.folder.name));
    this.modalEl.addClass("hn-create-modal");
    const { contentEl } = this;

    this.selector = contentEl.createDiv({
      cls: "hn-create-types",
      attr: { role: "radiogroup", "aria-label": t.createKindLabel },
    });
    this.selector.createDiv({ cls: "hn-create-selection", attr: { "aria-hidden": "true" } });
    const labels = [t.createKindNote, t.createKindFolderNote, t.createKindFolder];
    const icons = [Icons.note, Icons.folderNote, Icons.folder];
    this.kindButtons = CREATE_KINDS.map((kind, index) => {
      const button = this.selector.createEl("button", {
        attr: { type: "button", role: "radio" },
      });
      const icon = icons[index]();
      icon.setAttribute("aria-hidden", "true");
      button.appendChild(icon);
      button.createSpan({ text: labels[index] });
      button.addEventListener("click", () => this.selectKind(kind));
      button.addEventListener("keydown", (event) => {
        let next: number;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % CREATE_KINDS.length;
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index + CREATE_KINDS.length - 1) % CREATE_KINDS.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = CREATE_KINDS.length - 1;
        else return;
        event.preventDefault();
        this.selectKind(CREATE_KINDS[next]);
        this.kindButtons[next].focus();
      });
      return button;
    });

    new Setting(contentEl)
      .setClass("hn-create-name")
      .setName(t.createNameLabel)
      .addText((text) => {
        this.nameInput = text.inputEl;
        text.inputEl.setAttribute("aria-label", t.createNameLabel);
        text.setPlaceholder(t.createNamePlaceholder);
        text.onChange((value) => {
          this.name = value;
          this.partialFolder = null;
          this.clearError();
          this.syncPreview();
        });
        text.inputEl.addEventListener("keydown", (event) => {
          if (event.key === "Enter" && !event.isComposing) {
            event.preventDefault();
            void this.submit();
          }
        });
      });

    contentEl.createEl("p", { cls: "hn-create-preview-label", text: t.createPreviewLabel });
    this.previewEl = contentEl.createEl("pre", { cls: "hn-create-preview" });
    this.errorEl = contentEl.createDiv({ cls: "hn-create-error", attr: { role: "alert" } });
    this.clearError();

    new Setting(contentEl)
      .setClass("hn-create-actions")
      .addButton((button) => {
        this.cancelButton = button;
        button.setButtonText(t.createCancel);
        button.onClick(() => this.close());
      })
      .addButton((button) => {
        this.submitButton = button;
        button.setButtonText(t.createSubmit).setCta();
        button.onClick(() => void this.submit());
      });

    this.selectKind(this.kind);
    this.nameInput.focus();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private selectKind(kind: CreateKind): void {
    this.kind = kind;
    this.clearError();
    const index = CREATE_KINDS.indexOf(kind);
    this.selector.style.setProperty("--hn-selected", String(index));
    this.kindButtons.forEach((button, buttonIndex) => {
      const selected = index === buttonIndex;
      button.setAttribute("aria-checked", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    this.syncPreview();
  }

  private syncPreview(): void {
    const t = getStrings(this.plugin.settings.language);
    const name = normalizeName(this.kind, this.name) || t.createNamePlaceholder;
    const parent = `${this.folder.name}/`;
    this.previewEl.setAttribute("title", this.folder.path);
    if (this.kind === "note") this.previewEl.setText(`${parent}\n└── ${name}.md`);
    else if (this.kind === "folder") this.previewEl.setText(`${parent}\n└── ${name}/`);
    else this.previewEl.setText(`${parent}\n└── ${name}/\n    └── ${name}.md`);
  }

  private clearError(): void {
    this.errorEl?.setText("");
    this.errorEl?.hide();
    this.nameInput?.removeAttribute("aria-invalid");
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.submitButton.setDisabled(busy);
    this.cancelButton.setDisabled(busy);
    this.nameInput.disabled = busy;
    this.kindButtons.forEach((button) => { button.disabled = busy; });
  }

  private async submit(): Promise<void> {
    if (this.busy) return;
    const t = getStrings(this.plugin.settings.language);
    this.setBusy(true);
    const result = await createChild(this.plugin, this.folder, {
      kind: this.kind,
      name: this.name,
      retryPartialFolder: this.partialFolder ?? undefined,
    });

    if (result.ok) {
      this.close();
      if (result.kind === "note") {
        new Notice(t.createdNote(result.file.basename));
        await this.plugin.app.workspace.getLeaf(false).openFile(result.file);
      } else if (result.folderNote) {
        new Notice(t.createdNote(result.folderNote.basename));
        await this.plugin.app.workspace.getLeaf(false).openFile(result.folderNote);
      } else {
        new Notice(t.createdFolder(result.folder.name));
        this.plugin.refresh();
      }
      return;
    }

    this.setBusy(false);
    let message: string;
    if (result.reason === "exists") message = t.createExists;
    else if (result.reason === "invalid") message = t.createInvalidName;
    else if (result.reason === "partial") {
      this.partialFolder = result.folder ?? null;
      this.plugin.refresh();
      message = t.createPartial(describe(result.error));
    } else message = t.createFailed(describe(result.error));
    this.errorEl.setText(message);
    this.errorEl.show();
    this.nameInput.setAttribute("aria-invalid", "true");
    this.nameInput.focus();
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function promptCreateChild(plugin: HierarchyNavigator, folder: TFolder): void {
  new CreateChildModal(plugin, folder).open();
}
