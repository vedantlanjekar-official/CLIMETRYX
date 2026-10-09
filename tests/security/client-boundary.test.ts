import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith(".ts") || full.endsWith(".tsx") ? [full] : [];
  });
}

describe("client boundary", () => {
  it("does not import the service client or secret env helper from client modules", () => {
    const files = walk("components").concat(walk("app"));
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (!source.includes("use client")) continue;
      expect(source).not.toContain("supabase/admin");
      expect(source).not.toContain("SUPABASE_SECRET_KEY");
      expect(source).not.toContain("createServiceClient");
      expect(source, file).not.toContain("OPENAI_API_KEY");
      expect(source, file).not.toMatch(/@\/lib\/ai\/openai|openai-provider|@\/lib\/intelligence\/service|@ai-sdk\/openai/);
    }
  });

  it("keeps the OpenAI key server-only and out of public variables", () => {
    for (const file of ["lib/ai/openai.ts", "lib/intelligence/reports/openai-provider.ts", "lib/intelligence/service.ts", "lib/intelligence/queries.ts"]) {
      expect(readFileSync(file, "utf8").startsWith('import "server-only";'), file).toBe(true);
    }
    const all = walk("app").concat(walk("components"), walk("lib"));
    for (const file of all) expect(readFileSync(file, "utf8"), file).not.toMatch(/NEXT_PUBLIC_OPENAI|NEXT_PUBLIC_\w*API_KEY/);
    expect(readFileSync(".env.example", "utf8")).toMatch(/^OPENAI_API_KEY=\s*$/m);
  });

  it("does not ship the OpenAI key name or value in built client bundles", () => {
    const dir = path.join(".next", "static");
    let files: string[] = [];
    try {
      files = readdirSync(dir, { recursive: true }).map(String).filter((name) => name.endsWith(".js")).map((name) => path.join(dir, name));
    } catch {
      return;
    }
    const key = process.env.OPENAI_API_KEY?.trim();
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source.includes("OPENAI_API_KEY"), file).toBe(false);
      if (key) expect(source.includes(key), file).toBe(false);
    }
  });
});
