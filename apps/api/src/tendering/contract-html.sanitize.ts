const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'div',
  'span',
  'h1',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'blockquote',
  'hr',
]);

const ALLOWED_ATTRS = new Set([
  'class',
  'colspan',
  'rowspan',
  'lang',
]);

const MAX_CONTRACT_BODY_HTML_LENGTH = 500_000;

/** Strip scripts and disallowed tags/attrs from contract editor HTML. */
export function sanitizeContractBodyHtml(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Document content is empty');
  }
  if (trimmed.length > MAX_CONTRACT_BODY_HTML_LENGTH) {
    throw new Error('Document content is too large');
  }

  let html = trimmed
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src|xlink:href)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi, '');

  html = html.replace(/<\/?([a-zA-Z0-9:-]+)([^>]*)>/g, (match, tagName: string, attrs: string) => {
    const tag = tagName.toLowerCase();
    const isClose = match.startsWith('</');
    if (!ALLOWED_TAGS.has(tag)) {
      return '';
    }
    if (isClose) {
      return `</${tag}>`;
    }
    const selfClosing = /\/>$/.test(match) || tag === 'br' || tag === 'hr';
    const keptAttrs: string[] = [];
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRe.exec(attrs)) != null) {
      const name = attrMatch[1].toLowerCase();
      if (!ALLOWED_ATTRS.has(name)) {
        continue;
      }
      const value = attrMatch[3] ?? attrMatch[4] ?? attrMatch[5] ?? '';
      if (/javascript:|data:text\/html/i.test(value)) {
        continue;
      }
      keptAttrs.push(`${name}="${value.replace(/"/g, '&quot;')}"`);
    }
    const attrStr = keptAttrs.length ? ` ${keptAttrs.join(' ')}` : '';
    return selfClosing && (tag === 'br' || tag === 'hr')
      ? `<${tag}${attrStr} />`
      : `<${tag}${attrStr}>`;
  });

  return html.trim();
}

export function extractBodyInnerHtml(fullHtml: string): string {
  const match = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return (match?.[1] ?? fullHtml).trim();
}

export { MAX_CONTRACT_BODY_HTML_LENGTH };
