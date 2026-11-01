import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { AiMisconfigured, mapAiError } from "./ai-client";

const DEEPSEEK_API_URL = "https://api.deepseek.com";

type DeepSeekModel = {
  id?: string;
  supports_image_in?: boolean;
};

async function deepSeekModel(apiKey: string) {
  const response = await fetch(`${DEEPSEEK_API_URL}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let body: { data?: DeepSeekModel[]; error?: { type?: string; message?: string }; message?: string };
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw mapAiError(response.status, undefined, text);
  }
  if (!response.ok) throw mapAiError(response.status, body, text);
  const models = body.data ?? [];
  const configuredId = process.env.DEEPSEEK_MODEL;
  const selected = configuredId
    ? models.find((model) => model.id === configuredId)
    : models[0];
  if (!selected?.id) {
    throw new Error(
      configuredId
        ? "DEEPSEEK_MODEL is not in the account's current model list."
        : "DeepSeek returned no available models.",
    );
  }
  return {
    modelId: selected.id,
    supportsImages: selected.supports_image_in === true,
  };
}

export async function getAiProvider() {
  const deepSeekKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!deepSeekKey) {
    throw new AiMisconfigured(
      "DeepSeek is not connected yet. Add DEEPSEEK_API_KEY as a server environment variable, then restart the website. Recording and manual teaching still work without it.",
    );
  }

  const { modelId, supportsImages } = await deepSeekModel(deepSeekKey);
  const deepseek = createOpenAICompatible({
    name: "deepseek",
    baseURL: DEEPSEEK_API_URL,
    apiKey: deepSeekKey,
    includeUsage: true,
    supportsStructuredOutputs: false,
  });
  return {
    provider: "DeepSeek" as const,
    modelId,
    supportsImages,
    model: deepseek.chatModel(modelId),
    isGateway: false,
  };
}
