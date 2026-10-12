# Hierarchy Navigator

A non-invasive Obsidian plugin that renders a **parent / siblings / children navigation block** at the top of any note. Inspired by [SiYuan's `hierarchyNavigate`][siyuan-source] — same idea, adapted for Obsidian and AidenLX's Folder Note semantics.

[siyuan-source]: https://github.com/OpaqueGlass/syplugin-hierarchyNavigate

## ✨ Features

- **Zero source-file modifications.** The block is injected into the note view at runtime — reading view and Live Preview / Source editor alike. Your `.md` files stay exactly as you wrote them.
- **Every note, or Folder Notes.** The block renders on any `.md` file; plain notes simply navigate from their own folder. Works automatically with [AidenLX Folder Note][folder-note]. A Folder Note represents its containing folder in Parent, Siblings, and Children; for example, `Projects/Projects.md` is navigated as the `Projects/` node. Its Parent is the containing folder's parent, its Siblings come from that parent folder, and its Children come from the represented folder. The node you are on is never listed under Siblings — neither the file itself nor the folder a Folder Note stands for. Folder Note entries use a distinct icon and open the note directly. Also falls back to the same-name heuristic.
- **Obsidian-openable files only.** Extensions are checked against the app's own view registry (`viewRegistry.getTypeByExtension`), so scripts, `.DS_Store`, and other unsupported formats never show up.
- **Folders before files.** Every row sorts folders ahead of files, then by name in natural order (`9` sorts before `10`). A Folder Note sorts as the folder it stands for, and the vault's own interleaved order is never trusted — the folders you navigate by stay at the front of the row, and are the last thing pushed into the `+N` panel.
- **File-type icons.** A pill's glyph says what the file *is* at a glance — note, Canvas, Base, PDF, image, audio, video, code/markup (HTML, CSS, JS, JSON, …) or a generic file — tinted per family with Obsidian's own theme colours. See [File-type icons](#-file-type-icons).
- **One line or several.** Every section caps at the configured number of items and folds the rest into a “+N” peek panel; the cap holds across all rows. Keep each section on a single line — items the row cannot fit move into the panel rather than being cut off at the edge — or let it wrap onto as many lines as it needs. Hover or click the chip to unfold the panel: it fades in while its items cascade, and dismisses itself the moment the pointer leaves, on `Esc`, or on a click anywhere else.
- **Click to collapse.** Click the Hierarchy header to fold the whole block away while you write; the state is remembered across notes.
- **Homepage aware.** When the parent would be the vault root, the Parent row shows the note configured in the [Homepage plugin](https://github.com/novov/obsidian-homepage) with a dedicated house icon — one click back to your homepage. The row is hidden entirely at the root when no homepage is configured, or while you are already on the homepage.
- **Direct children only.** The Children row lists what is actually inside the folder (one level), which is what the Parent / Siblings rows navigate back out of.
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

The block always renders at the top of the note, always covers every `.md` file, and always lists one level of children — those used to be settings; they are now simply how the plugin behaves.

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
