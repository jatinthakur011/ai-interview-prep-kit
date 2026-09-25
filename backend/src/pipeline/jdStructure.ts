/**
 * Deterministic reading of how the posting itself words priority.
 * The brief: a "required" line and a "bonus points for" line are not the same thing.
 * The model proposes must/nice; this module can overrule it using the JD's own words.
 */
const NICE_MARKER = /\b(bonus|nice[- ]to[- ]have|nice to haves?|a plus|is a plus|preferred|good to have|desirable|extra points|optional)\b/i;
const MUST_MARKER = /\b(required|must|essential|mandatory)\b/i;
const NICE_HEADING = /(nice[- ]to[- ]have|bonus|preferred|good to have|a plus|extra credit|desirable|optional)/i;
const MUST_HEADING = /(requirements?|must[- ]have|required|qualifications|what you.?ll need|what we.?re looking for|about you|you have)/i;

export const normalize = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").replace(/\s+/g, " ").trim();

const isBullet = (l: string) => /^\s*([-*•·]|\d+[.)])\s+/.test(l);

function isHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 60 || isBullet(t)) return false;
  return t.endsWith(":") || NICE_HEADING.test(t) || MUST_HEADING.test(t);
}

/** Does the evidence text appear in the JD (whitespace/punctuation-insensitive)? */
export function evidenceInJd(jd: string, evidence: string): boolean {
  const ev = normalize(evidence);
  return ev.length >= 3 && normalize(jd).includes(ev);
}

function matches(text: string, ev: string): boolean {
  const n = normalize(text);
  return n.length >= 3 && (n.includes(ev) || (n.length >= 8 && ev.includes(n)));
}

/** Returns "nice" / "must" if the JD's wording settles it, otherwise null (trust the model). */
export function priorityHintFor(jd: string, evidence: string): "must" | "nice" | null {
  const ev = normalize(evidence);
  if (ev.length < 3) return null;
  let section: "must" | "nice" | null = null;

  for (const line of jd.split(/\r?\n/)) {
    if (isHeading(line)) {
      section = NICE_HEADING.test(line) ? "nice" : MUST_HEADING.test(line) ? "must" : null;
      continue;
    }
    if (normalize(line).length < 3) continue;

    // Judge wording at sentence level: one line can hold "Bonus: X. Y is required."
    const segments = line.split(/(?<=[.!?;])\s+/);
    const hit = segments.find((seg) => matches(seg, ev));
    const scope = hit ?? (matches(line, ev) ? line : null);
    if (scope === null) continue;

    if (NICE_MARKER.test(scope)) return "nice";
    if (MUST_MARKER.test(scope)) return "must";
    return section;
  }
  return null;
}
