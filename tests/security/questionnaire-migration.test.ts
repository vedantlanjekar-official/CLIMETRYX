import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20261010090000_assessment_questionnaire.sql", "utf8");

describe("questionnaire migration", () => {
  const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map((match) => match[1]!);

  it("enables row level security on every new table", () => {
    expect(tables.length).toBeGreaterThanOrEqual(9);
    for (const table of tables) expect(sql, table).toMatch(new RegExp(`alter table public\\.${table} enable row level security`));
  });

  it("restricts financial snapshots to owner, admin and analyst", () => {
    const policies = sql.match(/create policy input_financials_\w+ on public\.assessment_input_financials[\s\S]*?;/g) ?? [];
    expect(policies.length).toBeGreaterThan(0);
    for (const policy of policies) {
      expect(policy).toMatch(/array\['owner', 'admin', 'analyst'\]/);
      expect(policy).not.toMatch(/'member'|'viewer'/);
    }
  });

  it("keeps submitted input versions immutable", () => {
    expect(sql).not.toMatch(/create policy \w+ on public\.assessment_input_versions for (update|delete)/);
  });

  it("is additive", () => {
    expect(sql).not.toMatch(/drop table|truncate|delete from/i);
  });
});
