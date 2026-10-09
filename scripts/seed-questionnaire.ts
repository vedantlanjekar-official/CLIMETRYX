import { createClient } from "@supabase/supabase-js";
import { QUESTION_ENTRIES, STEPS } from "@/lib/questionnaire/registry";
import { TEMPLATE_KEY, TEMPLATE_VERSION } from "@/lib/questionnaire/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const expectedRef = process.env.SUPABASE_PROJECT_REF ?? "oqhnjuqjmqmmpfpegfet";

if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
if (new URL(url).hostname.split(".")[0] !== expectedRef) throw new Error(`Refusing to seed: the configured project is not ${expectedRef}.`);

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { error: templateError } = await supabase
    .from("assessment_templates")
    .upsert({ key: TEMPLATE_KEY, version: TEMPLATE_VERSION, step_count: STEPS.length, question_count: QUESTION_ENTRIES.length }, { onConflict: "key,version" });
  if (templateError) throw new Error(`Template: ${templateError.message}`);

  const rows = QUESTION_ENTRIES.map(({ question, step, path }) => ({
    template_key: TEMPLATE_KEY,
    template_version: TEMPLATE_VERSION,
    question_path: path,
    step_id: step.id,
    step_number: step.number,
    label: question.label,
    question_type: question.type,
    unit: question.unit ?? null,
    required: question.required,
    level: question.level,
    source_category: question.source,
    sensitivity: question.sensitivity,
    dimensions: question.dimensions,
    persistence_table: question.persistence.table,
    persistence_column: question.persistence.column,
    material: question.material,
    display_order: question.order,
    definition: { ...question, path },
  }));
  for (let index = 0; index < rows.length; index += 100) {
    const { error } = await supabase.from("question_definitions").upsert(rows.slice(index, index + 100), { onConflict: "template_key,template_version,question_path" });
    if (error) throw new Error(`Definitions ${index}: ${error.message}`);
  }
  console.log(`Seeded ${TEMPLATE_KEY} ${TEMPLATE_VERSION}: ${STEPS.length} steps, ${rows.length} questions.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seeding failed.");
  process.exit(1);
});
