export interface EngineConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
  maxTokens: number;
}

const DEFAULT_BASE_URL = "http://localhost:20128"; // OmniRoute (plain OpenAI-compatible)
const DEFAULT_MODEL = "default"; // OmniRoute routes server-side; passed through
const DEFAULT_MAX_TOKENS = 16384; // complete-file writes are long by design
const MAX_TOKENS_CEILING = 1_048_576;

function parseBaseUrl(value: string | undefined): string {
  const raw = value?.trim() || DEFAULT_BASE_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`NIHIL_ENGINE_BASE_URL is not a valid URL: "${raw}"`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`NIHIL_ENGINE_BASE_URL must be http(s), got "${raw}"`);
  }
  return raw;
}

function parseMaxTokens(value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return DEFAULT_MAX_TOKENS;
  }
  const trimmed = value.trim();
  const n = /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  if (!Number.isInteger(n) || n < 1 || n > MAX_TOKENS_CEILING) {
    throw new Error(
      `NIHIL_ENGINE_MAX_TOKENS must be a decimal integer between 1 and ${MAX_TOKENS_CEILING}, got "${value}"`,
    );
  }
  return n;
}

export function loadEngineConfig(env: NodeJS.ProcessEnv = process.env): EngineConfig {
  return {
    baseUrl: parseBaseUrl(env.NIHIL_ENGINE_BASE_URL),
    // Optional: keyless local OmniRoute omits the Authorization header.
    apiKey: env.NIHIL_ENGINE_API_KEY?.trim() || undefined,
    model: env.NIHIL_ENGINE_MODEL?.trim() || DEFAULT_MODEL,
    maxTokens: parseMaxTokens(env.NIHIL_ENGINE_MAX_TOKENS),
  };
}
