import "server-only";
import { generateText, Output } from "ai";
import { aiStatus, openAiModel } from "@/lib/ai/openai";
import type { NarrativeProvider } from "./compose";
import { aiReportSchema } from "./writer";

export function openAiNarrativeProvider(): { provider: NarrativeProvider | null; reason: string | null } {
  const configured = openAiModel();
  if (!configured) return { provider: null, reason: aiStatus().detail };
  return {
    reason: null,
    provider: {
      provider: "openai",
      model: configured.name,
      async generate({ instructions, prompt }) {
        const started = Date.now();
        const result = await generateText({
          model: configured.model,
          instructions,
          prompt,
          output: Output.object({ schema: aiReportSchema }),
          timeout: 90_000,
          maxRetries: 2,
        });
        return {
          body: result.output,
          inputTokens: result.usage.inputTokens ?? null,
          outputTokens: result.usage.outputTokens ?? null,
          latencyMs: Date.now() - started,
        };
      },
    },
  };
}
