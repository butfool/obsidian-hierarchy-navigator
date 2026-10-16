export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: {
    cls?: string;
    text?: string;
    attr?: Record<string, string>;
    children?: (Element | string)[];
  } = {},
): HTMLElementTagNameMap[K] {
  const node = createEl(tag, {
    cls: opts.cls,
    text: opts.text,
    attr: opts.attr,
  });
  node.append(...(opts.children ?? []));
  return node;
}
