<div align="center">

<h1>Hierarchy Navigator</h1>

<p><strong>A parent / siblings / children navigation block for every Obsidian note</strong></p>
<p>Requires Obsidian 1.4.0 or later</p>

<p>
  <a href="README.md">简体中文</a> |
  <strong>English</strong>
</p>

[![Version](https://img.shields.io/badge/Version-0.3.1-3DA639)](https://github.com/butfool/obsidian-hierarchy-navigator/releases/latest)
[![Obsidian](https://img.shields.io/badge/Obsidian-1.4.0%2B-7C3AED?logo=obsidian&logoColor=white)](https://obsidian.md)
[![License](https://img.shields.io/badge/License-MIT-3DA639?logo=opensourceinitiative&logoColor=white)](LICENSE)

</div>

---

<p align="center">
  <img src="docs/images/demo.png" alt="Hierarchy Navigator" width="100%">
</p>

## What is this

Hierarchy Navigator renders a navigation block at the top of every note in your vault, telling you where that note sits in the folder tree: which folder holds it, what else lives beside it, and what is inside it. Open any note and you see its parent, its siblings, and its children without switching to the file explorer.

The block is injected at render time and behaves identically in Reading view and Live Preview. Your `.md` files are never rewritten — the plugin writes to disk only when you explicitly ask it to create something.

Inspired by SiYuan's [`hierarchyNavigate`](https://github.com/OpaqueGlass/syplugin-hierarchyNavigate) and built on [AidenLX Folder Note](https://github.com/aidenlx/folder-note) semantics.

## Features

- Renders the same block in Reading view and Live Preview
- Works with Folder Note, so a Folder Note navigates as the folder it represents
- Filters extensions through Obsidian's own view registry, showing only files the app can open
- Sorts folders before files in natural order, so `9` comes before `10`
- Tints each pill by file type: note, Canvas, Base, PDF, image, audio, video, code
- Renders a children index inside the note body while a Folder Note is still empty, with a button to create notes and folders there
- Creates notes through Obsidian's own `createNewMarkdownFile`, never overwriting an existing path
- Ships English and 简体中文; switch under Settings and it applies immediately

## Install

The plugin is not on the community plugin store yet. Install it manually or through BRAT for now.

### Manual install

```bash
cd YOUR_VAULT/.obsidian/plugins
git clone https://github.com/butfool/obsidian-hierarchy-navigator.git hierarchy-navigator
cd hierarchy-navigator
npm install && npm run build
```

Then enable **Hierarchy Navigator** under **Settings → Community plugins → Installed plugins**.

The directory name must match the `id` in `manifest.json`, which is `hierarchy-navigator`. Any other name keeps Obsidian from recognising the plugin.

### BRAT preview

Add the repository to your BRAT plugin list:

```
https://github.com/butfool/obsidian-hierarchy-navigator.git
```

## Settings

**Settings → Hierarchy Navigator** controls:

| Setting | Options | Default |
|---|---|---|
| Language | English / 简体中文 | 简体中文 |
| Header label | free text | `Hierarchy` |
| Show parent folder | toggle | on |
| Show siblings | toggle | off |
| Show folders | toggle | on |
| Show files | toggle | on |
| Section layout | Single line / Wrap | Single line |
| Max items per section | number ≥ 1 | 6 |
| Show a children index in the note body | toggle | on |
| Show a create button in the body index | toggle | on |
| Create a FolderNote with a new folder | toggle | on |

Turn off the create button and the plugin becomes strictly read-only. Add `hierarchy-nav: hide` to a note's frontmatter to skip that one note. Clicking the header row folds the whole block away, and the folded state survives switching notes.

## Commands

Assign shortcuts under **Settings → Hotkeys**. Command names follow the plugin's interface language.

| Command | What it does |
|---|---|
| 在文件浏览器中定位父文件夹 | Selects the parent folder in the file explorer |
| 打开第一个子文件 | Opens the first entry under the current note |

## Development

```bash
git clone https://github.com/butfool/obsidian-hierarchy-navigator.git
cd obsidian-hierarchy-navigator
npm install
npm run dev      # watches src/ and rebuilds main.js on every change
```

Keep the repository at `YOUR_VAULT/.obsidian/plugins/hierarchy-navigator/` while developing, then reload Obsidian after each build.

## License

[MIT](LICENSE) © 2026 butcool
