# Hierarchy Navigator

A non-invasive Obsidian plugin that renders a **parent / siblings / children navigation block** at the top of any note. Inspired by [SiYuan's `hierarchyNavigate`][siyuan-source] — same idea, adapted for Obsidian and AidenLX's Folder Note semantics.

[siyuan-source]: https://github.com/OpaqueGlass/syplugin-hierarchyNavigate

## ✨ Features

- **Zero source-file modifications.** The block is injected into the note view at runtime — reading view and Live Preview / Source editor alike. Your `.md` files stay exactly as you wrote them.
- **Every note, or Folder Notes.** The block renders on any `.md` file; plain notes simply navigate from their own folder. Works automatically with [AidenLX Folder Note][folder-note]. A Folder Note represents its containing folder in Parent, Siblings, and Children; for example, `Projects/Projects.md` is navigated as the `Projects/` node. Its Parent is the containing folder's parent, its Siblings come from that parent folder, and its Children come from the represented folder. The node you are on is never listed under Siblings — neither the file itself nor the folder a Folder Note stands for. Folder Note entries use a distinct icon and open the note directly. Also falls back to the same-name heuristic.
- **Obsidian-openable files only.** Extensions are checked against the app's own view registry (`viewRegistry.getTypeByExtension`), so scripts, `.DS_Store`, and other unsupported formats never show up.
- **Folders before files.** Every row sorts folders ahead of files, then by name in natural order (`9` sorts before `10`). A Folder Note sorts as the folder it stands for, and the vault's own interleaved order is never trusted — the folders you navigate by stay at the front of the row, and are the last thing pushed into the `+N` panel.
- **File-type icons.** A pill's glyph says what the file *is* at a glance — note, Canvas, Base, PDF, image, audio, video, code/markup (HTML, CSS, JS, JSON, …) or a generic file — tinted per family with Obsidian's own theme colours. See [File-type icons](#-file-type-icons).
- **A children index in the note body.** Below the header block, this note's children also appear as a collection you can actually read: folders as tiles with their item counts, files as rows with their last-modified time. It uses the *text* font and text size — so it reads as note content, not as navigation chrome — and scrolls inside itself past ~half a pane. The `隐藏` button dismisses it, and that dismissal lasts only for the current session: reopening the note brings it back. Nothing is written anywhere.
- **One line or several.** Every section caps at the configured number of items and folds the rest into a “+N” peek panel; the cap holds across all rows. Keep each section on a single line — items the row cannot fit move into the panel rather than being cut off at the edge — or let it wrap onto as many lines as it needs. Hover or click the chip to unfold the panel: it fades in while its items cascade, and dismisses itself the moment the pointer leaves, on `Esc`, or on a click anywhere else.
- **Click to collapse.** Click the Hierarchy header to fold the whole block away while you write; the state is remembered across notes.
- **Homepage aware.** When the parent would be the vault root, the Parent row shows the note configured in the [Homepage plugin](https://github.com/novov/obsidian-homepage) with a dedicated house icon — one click back to your homepage. The row is hidden entirely at the root when no homepage is configured, or while you are already on the homepage.
- **Children belong to folders, not to files.** A plain note is a leaf, so its Children row is empty — its folder's other entries are its *siblings*, and repeating them under Children would just be the Siblings row twice. Only a Folder Note stands for a folder, and only then does Children list that folder's contents (one level) — the entries the Parent / Siblings rows navigate back out of.
- **Native Obsidian theming.** Uses CSS variables for every color so it adapts automatically to light / dark / custom themes.
- **Settings tab.** Header label, max items per row, and a toggle per section.
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
| Header label | free text | `Hierarchy` |
| Show parent folder | toggle | on |
| Show siblings | toggle | off |
| Show folders | toggle | on |
| Show files | toggle | on |
| Section layout | Single line / Multiple lines | Single line |
| Max items per section | number | 6 |
| Show a children index in the note body | toggle | on |

The block always renders at the top of the note, always covers every `.md` file, and always lists one level of children — those used to be settings; they are now simply how the plugin behaves.

## 📑 The body index

While a **Folder Note**'s body is empty and you are **reading** it, the plugin lays a children index over the page: folders first with their item counts, files with their last-modified time (relative, then a plain date). It is the "nothing here yet" page — one calm, roomy list, not a dashboard.

- **It is an overlay, not a block.** It hangs over the body area, below the header rail, rather than being inserted into the document. That buys three things:
  - nothing reflows when it appears or leaves — the text never moves a pixel (measured: the first line keeps the same y);
  - it needs no cooperation from the editor, Properties, or a theme's grid rules — a vault using `cssclasses: list-cards` is fine;
  - the header rail is never touched by it.
- **A Folder Note and an empty body.** Same gate as the Children row: only a note that stands for a folder has contents to index. Frontmatter is not body text, so a folder note that is only properties still counts as empty. A note with real content never gets the overlay: it would hide the thing you came to read.
- **Reading mode only.** Switch the note to editing and the launcher is simply not there — an overlay has no business covering the paragraph you are writing. There is no dismiss button and no state to keep: the mode *is* the switch. (If an overlay ever survived a mode change, clicking into the editor clears it.)
- **Its own scroll.** The list scrolls inside the overlay, so a 300-entry folder cannot push anything around.

The block lives in the pane content element and is anchored to the bottom edge of the header block (a `ResizeObserver` keeps it there when sections fold, chips wrap, or the pane resizes). Class names are `hn-index` / `hn-index-head` / `hn-index-row`, so a theme can restyle it without touching the header rail.

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

Two commands are registered (assign shortcuts via Settings → Hotkeys):

- **Reveal parent folder in file explorer**
- **Open the first child file**

## 🪪 License

MIT.
