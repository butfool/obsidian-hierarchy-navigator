<div align="center">

<h1>Hierarchy Navigator</h1>

<p><strong>在每篇笔记顶部渲染「父级 / 兄弟 / 子级」导航块的 Obsidian 插件</strong></p>
<p>需要 Obsidian 1.4.0 或更高版本</p>

<p>
  <strong>简体中文</strong> |
  <a href="README.en.md">English</a>
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

Hierarchy Navigator 在每篇笔记的顶部渲染一个导航块，说明这篇笔记在文件夹树中的位置：父级在哪里、旁边有哪些同级项、自己里面装着什么。打开任意一篇笔记，不切换到文件浏览器就能看到它的父级、兄弟与子项。

导航块在渲染时注入到笔记视图，阅读视图与 Live Preview 下表现一致。你的 `.md` 文件不会被改写；插件只在你明确要求新建笔记或文件夹时才写盘。

思路来自思源笔记的 [`hierarchyNavigate`](https://github.com/OpaqueGlass/syplugin-hierarchyNavigate)，并遵循 [AidenLX Folder Note](https://github.com/aidenlx/folder-note) 的语义实现。

## Features

- 阅读视图与 Live Preview 下渲染同一个导航块，两种模式行为一致
- 配合 Folder Note 工作，Folder Note 会以它所代表的文件夹参与导航
- 依据 Obsidian 自己的视图注册表过滤扩展名，只显示能被打开的文件
- 区块内文件夹排在文件前面，按自然顺序排列，`9` 排在 `10` 之前
- 每个条目按文件类型着色区分：笔记、Canvas、Base、PDF、图片、音频、视频、代码
- Folder Note 正文为空时，在正文区渲染子项索引，可直接在其中新建笔记或文件夹
- 新建操作走 Obsidian 自身的 `createNewMarkdownFile`，不会覆盖已存在的路径
- 界面提供 English 与 简体中文，在设置中切换后立即生效，无需重载

## Install

插件尚未上架社区插件市场，当前通过手动安装或 BRAT 使用。

### 手动安装

```bash
cd YOUR_VAULT/.obsidian/plugins
git clone https://github.com/butfool/obsidian-hierarchy-navigator.git hierarchy-navigator
cd hierarchy-navigator
npm install && npm run build
```

然后在 **Settings → Community plugins → Installed plugins** 中启用 **Hierarchy Navigator**。

目录名使用 `manifest.json` 中的 `id`，即 `hierarchy-navigator`。改用其他目录名会导致 Obsidian 无法识别插件。

### BRAT 预览版

在 BRAT 的插件列表中添加仓库地址：

```
https://github.com/butfool/obsidian-hierarchy-navigator.git
```

## Settings

**Settings → Hierarchy Navigator** 中可配置：

| 配置项 | 可选值 | 默认值 |
|---|---|---|
| Language | English / 简体中文 | 简体中文 |
| Header label | 自由文本 | `Hierarchy` |
| Show parent folder | 开关 | 开启 |
| Show siblings | 开关 | 关闭 |
| Show folders | 开关 | 开启 |
| Show files | 开关 | 开启 |
| Section layout | Single line / Wrap | Single line |
| Max items per section | 数字（不小于 1） | 6 |
| Show a children index in the note body | 开关 | 开启 |
| Show a create button in the body index | 开关 | 开启 |
| Create a FolderNote with a new folder | 开关 | 开启 |

关闭新建按钮后，插件变为严格只读。在某篇笔记的 frontmatter 中加入 `hierarchy-nav: hide` 可以单独跳过该笔记。点击导航块顶部的标题栏可以折叠整个区块，这个折叠状态会在切换笔记后保留。

## Commands

在 **Settings → Hotkeys** 中为以下命令分配快捷键，命令名称跟随插件的界面语言。

| 命令 | 作用 |
|---|---|
| 在文件浏览器中定位父文件夹 | 在文件浏览器中选中父级文件夹 |
| 打开第一个子文件 | 打开当前笔记下的第一个条目 |

## Development

```bash
git clone https://github.com/butfool/obsidian-hierarchy-navigator.git
cd obsidian-hierarchy-navigator
npm install
npm run dev      # 监听 src/ 目录，每次改动重新构建 main.js
```

开发时把仓库放在 vault 的 `.obsidian/plugins/hierarchy-navigator/` 下，每次构建完成后重载 Obsidian 即可看到效果。

## License

[MIT](LICENSE) © 2026 butcool
