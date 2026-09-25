/** Strips scripts/styles/tags to plain text, and collects same-origin-ish links with anchor text. */
export interface ExtractedPage {
  title: string;
  text: string;
  links: { href: string; text: string }[];
}

export function extractFromHtml(html: string, baseUrl: string): ExtractedPage {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : "";

  const links: { href: string; text: string }[] = [];
  const linkRe = /<a\b[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html))) {
    try {
      const href = new URL(m[1], baseUrl).toString();
      const text = decodeEntities(stripTags(m[2])).replace(/\s+/g, " ").trim();
      links.push({ href, text });
    } catch {
      /* malformed href: skip */
    }
  }

  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const text = decodeEntities(stripTags(body)).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();

  return { title, text, links };
}

function stripTags(s: string): string {
  return s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n").replace(/<[^>]+>/g, " ");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
