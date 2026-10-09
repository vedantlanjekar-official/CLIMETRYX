import "server-only";
import { createOpenAI } from "@ai-sdk/openai";

export const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";

export interface AiStatus {
  configured: boolean;
  provider: "openai";
  model: string;
  detail: string;
}

/** Safe to show in the UI: never includes the key or any part of it. */
export function aiStatus(): AiStatus {
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  if (process.env.AI_REPORTS_DISABLED === "true") {
    return { configured: false, provider: "openai", model, detail: "AI narratives are switched off (AI_REPORTS_DISABLED=true). Reports use rules-written narratives." };
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return { configured: false, provider: "openai", model, detail: "OPENAI_API_KEY is not set on the server. Reports are generated with rules-written narratives until it is configured." };
  }
  return { configured: true, provider: "openai", model, detail: `OpenAI Responses API, model ${model}.` };
}

export function openAiModel() {
  const status = aiStatus();
  if (!status.configured) return null;
  const provider = createOpenAI({ apiKey: process.env.OPENAI_API_KEY!.trim() });
  return { model: provider.responses(status.model), name: status.model };
}

export function estimateCostUsd(inputTokens: number | null, outputTokens: number | null): number | null {
  const input = Number(process.env.OPENAI_PRICE_INPUT_PER_MTOK);
  const output = Number(process.env.OPENAI_PRICE_OUTPUT_PER_MTOK);
  if (!Number.isFinite(input) || !Number.isFinite(output) || input <= 0 || output <= 0) return null;
  if (inputTokens === null || outputTokens === null) return null;
  return Math.round(((inputTokens * input + outputTokens * output) / 1_000_000) * 1e6) / 1e6;
}
