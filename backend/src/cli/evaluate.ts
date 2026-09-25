#!/usr/bin/env node
/**
 * Mandatory batch entry point (brief Section 9 / Appendix B):
 *   npm run evaluate -- --input <cases.json> --output <kits.json>
 *
 * Reads an array of {id, jd, company_url, days}, runs the SAME pipeline the
 * HTTP API uses (generateKit — no parallel implementation), and writes one
 * JSON file in the exact shape Appendix B specifies. A case that fails does
 * not abort the run; it is recorded with status "failed" and the run
 * continues (Section 9: "Continues after one case fails").
 *
 * "ok" vs "failed": generateKit() already treats an unreachable company site
 * or a company with no discoverable hiring page as a *degraded* result, not
 * a failure — it still returns a valid kit with an honest, sparse
 * company_brief (Section 10 / FAQ: "a missing hiring page is not a
 * failure"). "failed" here is reserved for cases where no kit could be
 * produced at all: an unparsable/empty job description, or a kit that
 * cannot be made to pass structural validation after generation.
 */
import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { generateKit, KitGenerationError } from "../pipeline/generateKit.js";
import { createLLMFromEnv } from "../llm/gemini.js";
import { createDiscussionClientFromEnv } from "../discussion/braveSearch.js";

const CaseSchema = z.object({
  id: z.string().min(1),
  jd: z.string(),
  company_url: z.string(),
  days: z.number().int().min(1),
});
const CasesFileSchema = z.array(CaseSchema);

interface KitEntry {
  id: string;
  status: "ok" | "failed";
  kit: unknown;
  error: { code: string; message: string } | null;
}

function parseArgs(argv: string[]): { input: string; output: string; concurrency: number } {
  const args: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      args[key] = value;
    } else {
      positional.push(argv[i]);
    }
  }
  // Fallback to positional args (evaluate.ts <input> <output>): some npm/shell combinations
  // (seen with npm on Windows PowerShell) drop the "--input"/"--output" flag names themselves
  // while still forwarding their values as bare positional args, so --input/--output alone
  // would otherwise fail even though the person ran the documented command correctly.
  const input = args.input ?? positional[0];
  const output = args.output ?? positional[1];
  if (!input || !output) {
    console.error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json> [--concurrency <n>]");
    console.error("   or: npm run evaluate -- <cases.json> <kits.json>");
    process.exit(1);
  }
  return { input, output, concurrency: Number(args.concurrency) || 2 };
}

/** Runs `tasks` with at most `limit` in flight at once, preserving no particular order requirement. */
async function runPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function processCase(
  c: z.infer<typeof CaseSchema>,
  llm: ReturnType<typeof createLLMFromEnv>,
  discussion: ReturnType<typeof createDiscussionClientFromEnv>
): Promise<KitEntry> {
  try {
    // Section 9: "company sites used with this command may be served from a
    // local address" — allowLocalFetch lets the crawler follow http://localhost.
    const { kit } = await generateKit({
      jd: c.jd,
      companyUrl: c.company_url,
      days: c.days,
      llm,
      discussion,
      allowLocalFetch: true,
    });
    return { id: c.id, status: "ok", kit, error: null };
  } catch (e) {
    const err =
      e instanceof KitGenerationError
        ? { code: e.code, message: e.message }
        : { code: "UNKNOWN_ERROR", message: (e as Error)?.message ?? String(e) };
    return { id: c.id, status: "failed", kit: null, error: err };
  }
}

async function main() {
  const { input, output, concurrency } = parseArgs(process.argv.slice(2));

  let rawCases: unknown;
  try {
    rawCases = JSON.parse(await readFile(input, "utf-8"));
  } catch (e) {
    console.error(`Could not read/parse input file ${input}: ${(e as Error).message}`);
    process.exit(1);
  }

  const parsedCases = CasesFileSchema.safeParse(rawCases);
  if (!parsedCases.success) {
    console.error(`Input file does not match the expected case shape: ${parsedCases.error.message}`);
    process.exit(1);
  }
  const cases = parsedCases.data;

  const llm = createLLMFromEnv();
  const discussion = createDiscussionClientFromEnv();

  console.error(`Running ${cases.length} case(s) with concurrency ${concurrency}...`);
  const kits = await runPool(cases, concurrency, async (c, i) => {
    const result = await processCase(c, llm, discussion);
    console.error(`[${i + 1}/${cases.length}] ${c.id}: ${result.status}`);
    return result;
  });

  const outputFile = {
    version: "1.0",
    generated_at: new Date().toISOString(),
    kits,
  };

  await writeFile(output, JSON.stringify(outputFile, null, 2), "utf-8");
  console.error(`Wrote ${kits.length} result(s) to ${output}`);

  if (kits.some((k) => k.status === "failed")) process.exitCode = 0; // partial failure is still a completed run
}

// Only run main() when this file is executed directly (`npm run evaluate`), not
// when processCase is imported for unit tests — otherwise importing this module
// triggers a real CLI run (and process.exit) as a side effect of the import.
// pathToFileURL (not a manual `file://${...}` template) is required here: on
// Windows, process.argv[1] uses backslashes and a drive letter (D:\...), which
// never equals the forward-slash file:// URL Node gives import.meta.url, so a
// naive string comparison silently made main() never run at all on Windows.
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((e) => {
    console.error("Fatal error running evaluate:", e);
    process.exit(1);
  });
}