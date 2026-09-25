/** Minimal robots.txt parser: enough to respect Disallow for our user agent and "*". */
export interface RobotsRules {
  isAllowed(path: string): boolean;
  crawlDelayMs?: number;
}

const USER_AGENT = "PrepKitBot";

export function parseRobots(text: string, userAgent = USER_AGENT): RobotsRules {
  const lines = text.split(/\r?\n/).map((l) => l.split("#")[0].trim()).filter(Boolean);
  type Group = { agents: string[]; disallow: string[]; allow: string[]; delay?: number };
  const groups: Group[] = [];
  let current: Group | null = null;

  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      if (!current || current.disallow.length || current.allow.length) {
        current = { agents: [], disallow: [], allow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (key === "disallow" && current) {
      if (value) current.disallow.push(value);
    } else if (key === "allow" && current) {
      if (value) current.allow.push(value);
    } else if (key === "crawl-delay" && current) {
      const n = Number(value);
      if (!Number.isNaN(n)) current.delay = n * 1000;
    }
  }

  const ua = userAgent.toLowerCase();
  const applicable = groups.filter((g) => g.agents.includes(ua)).length
    ? groups.filter((g) => g.agents.includes(ua))
    : groups.filter((g) => g.agents.includes("*"));

  const rules = applicable.flatMap((g) => [
    ...g.disallow.map((p) => ({ prefix: p, allow: false })),
    ...g.allow.map((p) => ({ prefix: p, allow: true })),
  ]);
  const delay = applicable.find((g) => g.delay !== undefined)?.delay;

  return {
    crawlDelayMs: delay,
    isAllowed(path: string) {
      let best: { prefix: string; allow: boolean } | null = null;
      for (const r of rules) {
        if (r.prefix === "" || path.startsWith(r.prefix)) {
          if (!best || r.prefix.length > best.prefix.length) best = r;
        }
      }
      return best ? best.allow : true;
    },
  };
}

export const allowAllRobots: RobotsRules = { isAllowed: () => true };
