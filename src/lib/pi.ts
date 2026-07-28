// Provider config for pi (https://github.com/earendil-works/pi), a terminal
// coding agent that speaks OpenAI chat-completions. pi discovers custom
// endpoints from ~/.pi/agent/models.json, so pointing it at `freellama serve`
// is purely a config concern — no protocol work on our side.

import { join } from "@std/path";

/** Key this provider is written under in models.json. */
export const PI_PROVIDER = "freellama";

export interface PiModel {
  id: string;
  contextWindow: number;
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
}

export interface PiProvider {
  baseUrl: string;
  api: "openai-completions";
  apiKey: string;
  models: PiModel[];
}

interface PiConfig {
  providers: Record<string, unknown>;
  [key: string]: unknown;
}

export function piConfigPath(): string {
  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE");
  if (!home) throw new Error("Cannot determine home directory (HOME is unset)");
  return join(home, ".pi", "agent", "models.json");
}

/** The context size llama-server gets from FREELLAMA_CTX (see runner.ts). */
export function contextWindow(): number {
  const raw = Deno.env.get("FREELLAMA_CTX");
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 4096;
}

export function buildPiProvider(baseUrl: string, models: string[], ctx: number): PiProvider {
  return {
    baseUrl,
    api: "openai-completions",
    // The server ignores auth entirely, but pi expects the field to exist.
    apiKey: "unused",
    models: models.map((id) => ({
      id,
      // pi defaults this to 128k. llama-server is started with FREELLAMA_CTX,
      // so leaving it unset lets pi grow a conversation far past the KV cache.
      contextWindow: ctx,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    })),
  };
}

/**
 * Merge the freellama provider into an existing models.json. Only the
 * freellama key is replaced — hand-written providers and any unknown
 * top-level settings are preserved.
 */
export function mergePiConfig(existing: string | undefined, provider: PiProvider): string {
  const config: PiConfig = { providers: {} };

  if (existing?.trim()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(existing);
    } catch (err) {
      throw new Error(
        `Existing pi config is not valid JSON (${
          err instanceof Error ? err.message : String(err)
        }). Fix or move it, then retry.`,
      );
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Existing pi config must contain a JSON object");
    }
    Object.assign(config, parsed);
    const providers = (parsed as PiConfig).providers;
    config.providers = typeof providers === "object" && providers !== null &&
        !Array.isArray(providers)
      ? { ...providers }
      : {};
  }

  config.providers[PI_PROVIDER] = provider;
  return JSON.stringify(config, null, 2) + "\n";
}
