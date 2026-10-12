import type { Locale } from "./types";

/**
 * Every string this plugin puts on screen, in one place.
 *
 * The block labels, the body index and the settings tab all read from here,
 * so a language is a single table rather than a scatter of ternaries. Counts
 * and times are functions because word order differs between the two
 * languages — English needs "3 items" where Chinese wants "3 项", and English
 * pluralises where Chinese does not.
 */
export interface Strings {
  /* ── Header block ── */
  /** Label of the parent row. */
  parent: string;
  /** Label of the siblings row. */
  siblings: string;
  /** Label of the children row. */
  children: string;
  /** Tooltip of the "+N" overflow chip. */
  overflowChip: (count: number) => string;

  /* ── Body index ── */
  /** Heading of the overlay index. */
  bodyIndexTitle: string;
  /** "3 folders · 12 files" under the heading. */
  bodyIndexCounts: (folders: number, files: number) => string;
  /** Item count trailing a folder row. */
  folderItemCount: (count: number) => string;
  /** Relative timestamps trailing a file row. */
  justNow: string;
  minutesAgo: (count: number) => string;
  hoursAgo: (count: number) => string;
  daysAgo: (count: number) => string;

  /* ── Commands ── */
  revealParentCommand: string;
  openFirstChildCommand: string;

  /* ── Settings tab ── */
  settings: SettingsStrings;
}

export interface SettingsStrings {
  intro: string;
  languageName: string;
  languageDesc: string;
  headerLabelName: string;
  headerLabelDesc: string;
  sectionsHeading: string;
  showParentName: string;
  showParentDesc: string;
  showSiblingsName: string;
  showSiblingsDesc: string;
  showFoldersName: string;
  showFoldersDesc: string;
  showFilesName: string;
  showFilesDesc: string;
  layoutHeading: string;
  sectionLayoutName: string;
  sectionLayoutDesc: string;
  sectionLayoutSingle: string;
  sectionLayoutWrap: string;
  maxItemsName: string;
  maxItemsDesc: string;
  bodyIndexHeading: string;
  showBodyIndexName: string;
  showBodyIndexDesc: string;
  tipsHeading: string;
  tips: string;
}

/** Dropdown entries for the language setting. Each language names itself. */
export const LANGUAGES: Array<{ value: Locale; label: string }> = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
];

const en: Strings = {
  parent: "Parent",
  siblings: "Siblings",
  children: "Children",
  overflowChip: (count) => `Show ${count} more`,

  bodyIndexTitle: "Children",
  bodyIndexCounts: (folders, files) =>
    `${folders} ${folders === 1 ? "folder" : "folders"} · ` +
    `${files} ${files === 1 ? "file" : "files"}`,
  folderItemCount: (count) => `${count} ${count === 1 ? "item" : "items"}`,
  justNow: "just now",
  minutesAgo: (count) => `${count} min ago`,
  hoursAgo: (count) => (count === 1 ? "1 hour ago" : `${count} hours ago`),
  daysAgo: (count) => (count === 1 ? "1 day ago" : `${count} days ago`),

  revealParentCommand: "Reveal parent folder in file explorer",
  openFirstChildCommand: "Open the first child file",

  settings: {
    intro:
      "Display a parent / siblings / children navigation block at the top of " +
      "any note. Source files are never modified.",
    languageName: "Language",
    languageDesc:
      "Language of this plugin's own interface — the navigation block, the " +
      "body index and this settings page. Your notes are never touched.",
    headerLabelName: "Header label",
    headerLabelDesc:
      "Short label shown above the block. Falls back to 'Hierarchy' if empty.",
    sectionsHeading: "Sections",
    showParentName: "Show parent folder",
    showParentDesc:
      "Render the folder containing this note. At the vault root the " +
      "homepage note (Homepage plugin) is shown instead; the row is " +
      "hidden when neither applies.",
    showSiblingsName: "Show siblings",
    showSiblingsDesc:
      "Render the notes and folders next to the current one. The current " +
      "node — the file itself, or the folder a Folder Note stands for — " +
      "is never listed, since you are already there. The row is dropped " +
      "when there is nothing beside it.",
    showFoldersName: "Show folders",
    showFoldersDesc:
      "Render folder entries, in the children row and the siblings row.",
    showFilesName: "Show files",
    showFilesDesc:
      "Render file entries, in the children row and the siblings row.",
    layoutHeading: "Layout",
    sectionLayoutName: "Section layout",
    sectionLayoutDesc:
      "Single line keeps each section one row tall, so items the row can't " +
      "fit stay hidden behind the “+N” panel. Multiple lines let a " +
      "section use as many rows as its items need.",
    sectionLayoutSingle: "Single line",
    sectionLayoutWrap: "Multiple lines",
    maxItemsName: "Max items per section",
    maxItemsDesc:
      "Most items shown per section; the rest collapse into a “+N” panel. " +
      "In multiple-line layout this caps all rows together. On a single " +
      "line the row may show fewer, because anything that does not fit " +
      "the pane width moves into that same panel instead of being cut off.",
    bodyIndexHeading: "Body index",
    showBodyIndexName: "Show a children index in the note body",
    showBodyIndexDesc:
      "While the note body is empty — whitespace, or frontmatter and " +
      "nothing else — lay a children index over it: folders first with " +
      "their item counts, files with their last modified time. It is an " +
      "overlay, not part of the document: nothing reflows when it appears, " +
      "reading mode only: switch the note to editing and it is simply not " +
      "there, so it can never cover what you are writing. Nothing is " +
      "written to disk and the header block is never touched.",
    tipsHeading: "Tips",
    tips:
      "Add `hierarchy-nav: hide` to a note's frontmatter to exclude it from " +
      "this plugin entirely.",
  },
};

const zh: Strings = {
  parent: "父级",
  siblings: "同级",
  children: "子级",
  overflowChip: (count) => `展开其余 ${count} 项`,

  bodyIndexTitle: "子节点",
  bodyIndexCounts: (folders, files) => `${folders} 文件夹 · ${files} 文件`,
  folderItemCount: (count) => `${count} 项`,
  justNow: "刚刚",
  minutesAgo: (count) => `${count} 分钟前`,
  hoursAgo: (count) => `${count} 小时前`,
  daysAgo: (count) => `${count} 天前`,

  revealParentCommand: "在文件浏览器中定位父文件夹",
  openFirstChildCommand: "打开第一个子文件",

  settings: {
    intro:
      "在任意笔记顶部显示 父级 / 同级 / 子级 导航区块。" +
      "永远不会修改源文件。",
    languageName: "语言",
    languageDesc:
      "插件自身界面的语言 —— 导航区块、正文索引和这个设置页。" +
      "不会影响你笔记的内容。",
    headerLabelName: "标题文本",
    headerLabelDesc: "区块顶部显示的简短标题。留空则使用 “Hierarchy”。",
    sectionsHeading: "区块",
    showParentName: "显示父级",
    showParentDesc:
      "显示包含此笔记的文件夹。在库根目录改为显示主页笔记" +
      "（Homepage 插件）；两者都不适用时整行隐藏。",
    showSiblingsName: "显示同级",
    showSiblingsDesc:
      "显示与当前节点相邻的笔记和文件夹。当前节点本身 —— 笔记自身，" +
      "或 Folder Note 所代表的那个文件夹 —— 不会列出，因为你已经在" +
      "那里了。旁边没有东西时整行不显示。",
    showFoldersName: "显示文件夹",
    showFoldersDesc: "在子级和同级列表中显示文件夹条目。",
    showFilesName: "显示文件",
    showFilesDesc: "在子级和同级列表中显示文件条目。",
    layoutHeading: "布局",
    sectionLayoutName: "区块排版",
    sectionLayoutDesc:
      "单行：每个区块占一行，放不下的条目收进 “+N” 面板。" +
      "多行：区块按需要占用多行。",
    sectionLayoutSingle: "单行",
    sectionLayoutWrap: "多行",
    maxItemsName: "每区最多条目",
    maxItemsDesc:
      "每个区块最多显示的条目数，其余收进 “+N” 面板。多行排版下这是" +
      "所有行的总数上限；单行排版下行内可能显示更少，因为放不下的部分" +
      "会移入同一个面板，而不是被裁掉。",
    bodyIndexHeading: "正文索引",
    showBodyIndexName: "在正文中显示子级索引",
    showBodyIndexDesc:
      "当笔记正文为空时 —— 只有空白，或只有属性 —— 在正文上覆盖一层" +
      "子级索引：文件夹在前并显示条目数，文件显示最后修改时间。它是" +
      "覆盖层而不是文档的一部分：出现时不会引起任何重排；只在阅读模式" +
      "显示，切到编辑模式它就不在，因此永远不会遮住你正在写的内容。" +
      "不写入磁盘，也不影响顶部区块。",
    tipsHeading: "提示",
    tips: "在笔记的 frontmatter 中加入 `hierarchy-nav: hide`，即可让该笔记完全跳过本插件。",
  },
};

const TABLES: Record<Locale, Strings> = { zh, en };

/** The string table for a language, falling back to English. */
export function getStrings(locale: Locale): Strings {
  return TABLES[locale] ?? TABLES.en;
}
