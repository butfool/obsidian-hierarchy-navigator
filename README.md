# Hierarchy Navigator

A non-invasive Obsidian plugin that renders a **parent / siblings / children navigation block** at the top of any note. Inspired by [SiYuan's `hierarchyNavigate`][siyuan-source] — same idea, adapted for Obsidian and AidenLX's Folder Note semantics.

[siyuan-source]: https://github.com/OpaqueGlass/syplugin-hierarchyNavigate

## ✨ Features

- **Zero source-file modifications.** The block is injected into the note view at runtime — reading view and Live Preview / Source editor alike. Your `.md` files stay exactly as you wrote them; the only thing the plugin ever puts on disk is a new note or folder you explicitly asked for. See [Creating children](#-creating-children).
- **Every note, or Folder Notes.** The block renders on any `.md` file; plain notes simply navigate from their own folder. Works automatically with [AidenLX Folder Note][folder-note]. A Folder Note represents its containing folder in Parent, Siblings, and Children; for example, `Projects/Projects.md` is navigated as the `Projects/` node. Its Parent is the containing folder's parent, its Siblings come from that parent folder, and its Children come from the represented folder. The node you are on is never listed under Siblings — neither the file itself nor the folder a Folder Note stands for. Folder Note entries use a distinct icon and open the note directly. Also falls back to the same-name heuristic.
- **Obsidian-openable files only.** Extensions are checked against the app's own view registry (`viewRegistry.getTypeByExtension`), so scripts, `.DS_Store`, and other unsupported formats never show up.
- **Folders before files.** Every row sorts folders ahead of files, then by name in natural order (`9` sorts before `10`). A Folder Note sorts as the folder it stands for, and the vault's own interleaved order is never trusted — the folders you navigate by stay at the front of the row, and are the last thing pushed into the `+N` panel.
- **File-type icons.** A pill's glyph says what the file *is* at a glance — note, Canvas, Base, PDF, image, audio, video, code/markup (HTML, CSS, JS, JSON, …) or a generic file — tinted per family with Obsidian's own theme colours. See [File-type icons](#-file-type-icons).
- **A children index in the note body.** Below the header block, this note's children also appear as a collection you can actually read: folders with their item counts, files with their last-modified time. It uses the *text* font and text size — so it reads as note content, not as navigation chrome — and it is a block in the note, so it scrolls with the text like everything else.
- **Create from the index.** An empty Folder Note's index carries a **New** button in its top-right corner: create a note or a folder right there, and let a new folder bring its own FolderNote along. It is the one place the plugin writes anything, and it never overwrites.
- **中文 / English.** Every piece of interface the plugin adds — the block labels, the body index, the create dialog, the two commands and this settings page — is translated. Switch under **Settings → Hierarchy Navigator → Language**; it applies immediately, with no reload and no effect on your notes.
- **No empty rows.** A section with nothing to show is not rendered at all: a plain note has no Children row, a note alone in its folder has no Siblings row, and an empty folder's Folder Note has neither. The rows you see are always rows you can navigate.
- **One line or several.** Every section caps at the configured number of items and folds the rest into a “+N” peek panel; the cap holds across all rows. Keep each section on a single line — items the row cannot fit move into the panel rather than being cut off at the edge — or let it wrap onto as many lines as it needs. Hover or click the chip to unfold the panel: it fades in while its items cascade, and dismisses itself the moment the pointer leaves, on `Esc`, or on a click anywhere else.
- **Click to collapse.** Click the Hierarchy header to fold the whole block away while you write; the state is remembered across notes.
- **Homepage aware.** When the parent would be the vault root, the Parent row shows the note configured in the [Homepage plugin](https://github.com/novov/obsidian-homepage) with a dedicated house icon — one click back to your homepage. The row is hidden entirely at the root when no homepage is configured, or while you are already on the homepage.
- **Children belong to folders, not to files.** A plain note is a leaf, so it has no Children row at all — its folder's other entries are its *siblings*, and repeating them under Children would just be the Siblings row twice. Only a Folder Note stands for a folder, and only then does Children list that folder's contents (one level) — the entries the Parent / Siblings rows navigate back out of.
- **Native Obsidian theming.** Uses CSS variables for every color so it adapts automatically to light / dark / custom themes.
- **Settings tab.** Language, header label, max items per row, a toggle per section, and the create button.
- **Frontmatter opt-out.** Add `hierarchy-nav: hide` to skip a single note.

[folder-note]: https://github.com/aidenlx/folder-note

## 📸 Preview

```
┌──────────────────────────────────────────────────┐
│ ▾ ◆  HIERARCHY                                   │
├──────────────────────────────────────────────────┤
│   ⌃ Parent                  Parent              │
│   ┌────────────────────────────────────────────┐ │
│   │ 📁  Projects                            ›  │ │
│   └────────────────────────────────────────────┘ │
│                                                  │
│   ⌄ Children                 Children            │
│   ┌─────────────┬─────────────┬─────────────┐    │
│   │ 📁 nested   │ 📁 sub-dir  │ 📄 archive   │    │
│   │   dir       │   dir       │   file      │    │
│   ├─────────────┼─────────────┴─────────────┤    │
│   │ 📄 note-2   │ 🌐 page.html               │    │
│   │   file      │   file                     │    │
│   └─────────────┴────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

(That's the design *intent*. Real rendering uses SVG icons, not emoji: folders come first, and every pill wears a glyph for its file type.)

## 🔧 Install

Until this ships in the Community Plugin store:

1. Clone this repository to `your-vault/.obsidian/plugins/obsidian-hierarchy-navigator/` (or symlink it).
2. Install dependencies & build:
   ```bash
   npm install
   npm run build
   ```
3. In Obsidian: **Settings → Community plugins → Installed plugins** → enable **Hierarchy Navigator**.

For development with hot-reload:
```bash
npm run dev   # watches src/ and rebuilds main.js on every change
```

## ⚙️ Settings

Open **Settings → Hierarchy Navigator** to configure:

| Setting | Options | Default |
|---|---|---|
| Language | 中文 / English | 中文 |
| Header label | free text | `Hierarchy` |
| Show parent folder | toggle | on |
| Show siblings | toggle | off |
| Show folders | toggle | on |
| Show files | toggle | on |
| Section layout | Single line / Multiple lines | Single line |
| Max items per section | number | 6 |
| Show a children index in the note body | toggle | on |
| Show a create button in the body index | toggle | on |
| Create a FolderNote with a new folder | toggle | on |

The block always renders at the top of the note, always covers every `.md` file, and always lists one level of children — those used to be settings; they are now simply how the plugin behaves. Rows with nothing in them are not rendered, so a section that would be empty simply isn't there.

## 🌐 Language

The plugin's own interface — the row labels, the body index, the `+N` chip's tooltip, both commands and the settings page — ships in **中文** and **English**. Change it under **Settings → Hierarchy Navigator → Language**; the block and the settings page switch on the spot, no reload.

Two things it deliberately does *not* touch:

- **your notes.** Nothing is ever written to a note, and no note text is translated. (The create button adds a *new* file when you ask it to; it never edits one.)
- **Obsidian's own UI.** That follows your Obsidian language setting, not this one.

Adding a language is one table: every string lives in [`src/i18n.ts`](src/i18n.ts), typed by the `Strings` interface, so a missing key is a compile error rather than a blank label.

## 📑 The body index

While a **Folder Note**'s body is empty and you are **reading** it, the plugin renders a children index where the body would begin: folders first with their item counts, files with their last-modified time (relative, then a plain date). It is the "nothing here yet" page — one calm, roomy list, not a dashboard.

- **It is a block in the note, not a panel over the pane.** It is inserted directly under the header rail, inside the reading column, so it scrolls with the text like any other content. That is safe precisely because the index only exists while the body is empty: there is nothing below it to displace, so appearing and leaving still moves nothing you can see.
- **It follows the note's own layout.** Width, margins and scroll come from the reading column (`--file-line-width`, `--file-margins`) instead of from a measured pixel offset, so nothing has to be re-measured when a theme draws the title as a grid or the Properties block grows.
- **Properties come first.** Frontmatter does not count as body, so a note whose only content is properties still gets the launcher — and because the index is placed after Properties in the document, those properties stay exactly where they are, above the list.
- **A Folder Note and an empty body.** Same gate as the Children row: only a note that stands for a folder has contents to index. A folder with no children yet still gets the panel while the create button is on — it reads *Nothing here yet* and offers the button, which is exactly the page where you want to add the first thing. With create switched off, an empty folder draws nothing at all, as before. Frontmatter is not body text, so a folder note that is only properties still counts as empty. A note with real content never gets the index — it would sit under writing that already exists.
- **Reading mode only.** Switch the note to editing and the launcher is simply not there — a launcher has no business sitting between you and the paragraph you are writing. There is no dismiss button and no state to keep: the mode *is* the switch. (If an index ever survived a mode change, clicking into the editor clears it.)
- **The page scrolls, not a nested panel.** A 300-entry folder makes the note scrollable; there is no inner scroll container to fall into.

The index is a sibling of the header block, both mounted by `main.ts` in the pane's content element. Class names are `hn-index` / `hn-index-head` / `hn-index-row`, so a theme can restyle it without touching the header rail.

## ➕ Creating children

An empty Folder Note's index carries a **New** button at the right end of its head. It creates things *in the folder the note stands for* — the very folder whose contents that index is listing, so what you make shows up in the list you made it from.

- **A note or a folder.** Choose the type, type a name, press `Enter`. A new note opens in the same pane, like Obsidian's own "New note"; a new folder simply appears as a row in the index.
- **A folder can bring its FolderNote.** For a folder the dialog also offers *Also create a FolderNote*, which puts `Name/Name.md` inside it — the convention the rest of this plugin navigates by, so the new folder is a node in the hierarchy the moment it exists. The checkbox starts from the setting below; untick it for one folder without changing the default.
- **It never overwrites.** If something already sits at that path, the dialog says so and stays open with the name selected, so you can fix it. Empty names and characters a path cannot hold (`\ / : * ? " < > |`) are refused the same way.
- **It is the plugin's only write path.** New notes go through Obsidian's own `fileManager.createNewMarkdownFile`, so your default frontmatter and folder template apply exactly as they would for a note created in the file explorer. Existing notes are never edited, moved or renamed. Turn the button off under **Settings → Hierarchy Navigator → Show a create button in the body index** to make the plugin strictly read-only again.
- **Only where it makes sense.** The button lives in the body index, so it is available on an empty Folder Note in reading mode — the "this folder is empty" page, including a folder with nothing in it yet. A folder note you have already written in is content, not a launcher, and gets no button.

## 🎨 File-type icons

Every pill carries `hn-pill hn-kind-<file|dir|folder-note|home>`; files add `hn-type-<family>`, which picks both the glyph and its tint.

| Family | Class | Extensions |
|---|---|---|
| Note | `hn-type-note` | `md`, `markdown`, `mdx` |
| PDF | `hn-type-pdf` | `pdf` |
| Canvas | `hn-type-canvas` | `canvas` |
| Base | `hn-type-base` | `base` |
| Image | `hn-type-image` | `png`, `jpg`, `jpeg`, `gif`, `bmp`, `svg`, `webp`, `avif`, `ico`, `tif`, `tiff` |
| Audio | `hn-type-audio` | `mp3`, `wav`, `m4a`, `ogg`, `oga`, `opus`, `flac`, `aac`, `3gp` |
| Video | `hn-type-video` | `mp4`, `webm`, `ogv`, `mov`, `mkv`, `avi` |
| Code / markup | `hn-type-code` | `html`, `htm`, `xhtml`, `css`, `scss`, `sass`, `less`, `js`, `mjs`, `cjs`, `jsx`, `ts`, `tsx`, `json`, `jsonc`, `xml`, `yaml`, `yml`, `toml`, `ini`, `py`, `rb`, `go`, `rs`, `java`, `kt`, `php`, `c`, `h`, `cpp`, `hpp`, `cs`, `sh`, `bash`, `zsh`, `fish`, `sql`, `tex` |
| Anything else | `hn-type-file` | generic page glyph |

Tints use Obsidian's `--color-*` theme variables (with fixed fallbacks), so they follow your theme. To flatten the palette or retint one family, override its class:

```css
/* Monochrome rows: no tint at all */
.hn-pill[class*="hn-type-"] svg { color: var(--hn-text-muted); opacity: 0.7; }

/* Or just dim one family */
.hn-pill.hn-type-code svg { color: var(--text-faint); }
```

Notes are deliberately left untinted, so the coloured families are what stands out.

## 🚫 Opting out

Add this anywhere in a note's YAML frontmatter:

```yaml
hierarchy-nav: hide
```

The plugin will skip that note.

## 🔌 Commands

Two commands are registered (assign shortcuts via Settings → Hotkeys). Their names follow the plugin's language setting:

- **Reveal parent folder in file explorer** — 在文件浏览器中定位父文件夹
- **Open the first child file** — 打开第一个子文件

## 🪪 License

MIT.
