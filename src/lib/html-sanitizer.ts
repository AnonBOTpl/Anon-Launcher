/**
 * Shared HTML sanitizer for Modrinth project descriptions.
 * Modrinth API returns body as HTML (from Modrinth Flavored Markdown).
 * Extracted from ModSearch.tsx for reuse in ContentBrowser.tsx.
 */

const ALLOWED_TAGS = [
  "p", "br", "hr",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "strong", "em", "b", "i", "u", "s",
  "a",
  "pre", "code", "blockquote",
  "table", "thead", "tbody", "tr", "th", "td",
  "img",
  "div", "span",
  "sub", "sup",
];

export function sanitizeHtml(html: string): string {
  const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(html);
  if (!hasHtmlTags) {
    return html
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>");
  }

  let cleaned = html;
  // Strip event handlers
  cleaned = cleaned.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Strip non-http protocols from href/src
  cleaned = cleaned.replace(
    /(href|src)\s*=\s*(?:"(?!https?:\/\/|\/|#)[^"]*"|'(?!https?:\/\/|\/|#)[^']*')/gi,
    "$1=''",
  );
  cleaned = cleaned.replace(/href\s*=\s*"\s*javascript:[^"]*"/gi, 'href=""');
  cleaned = cleaned.replace(/href\s*=\s*'\s*javascript:[^']*'/gi, "href=''");
  // Strip disallowed tags
  cleaned = cleaned.replace(/<\/?\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (_match, tagName: string) => {
    const lower = tagName.toLowerCase();
    if (ALLOWED_TAGS.includes(lower)) return _match;
    return "";
  });

  return cleaned;
}
