// Model storage: ~/.freellama/{models,bin,manifest.json}. Override the root with FREELLAMA_HOME.

import { join } from "@std/path";

export interface ModelEntry {
  /** Full source URI, e.g. "hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M". */
  uri: string;
  /** Absolute path of the GGUF file on disk (the first part for split models). */
  file: string;
  /** All parts of a split (multi-part) GGUF, in order. Absent for single-file models. */
  files?: string[];
  /** Total size across all parts. */
  sizeBytes: number;
  /** ISO timestamp of when the model was pulled. */
  pulledAt: string;
}

export interface Manifest {
  models: Record<string, ModelEntry>;
}

export function freellamaHome(): string {
  const override = Deno.env.get("FREELLAMA_HOME");
  if (override) return override;
  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE");
  if (!home) throw new Error("Cannot determine home directory (HOME is unset)");
  return join(home, ".freellama");
}

export function modelsDir(): string {
  return join(freellamaHome(), "models");
}

export function binDir(): string {
  return join(freellamaHome(), "bin");
}

function manifestPath(): string {
  return join(freellamaHome(), "manifest.json");
}

/** Strip the "hf:" scheme so users can pass either a name or a full URI. */
export function normalizeName(input: string): string {
  return input.startsWith("hf:") ? input.slice(3) : input;
}

export function toUri(name: string): string {
  return name.startsWith("hf:") ? name : `hf:${name}`;
}

export async function readManifest(): Promise<Manifest> {
  try {
    const raw = await Deno.readTextFile(manifestPath());
    const parsed = JSON.parse(raw) as Manifest;
    return { models: parsed.models ?? {} };
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return { models: {} };
    throw err;
  }
}

export async function writeManifest(manifest: Manifest): Promise<void> {
  await Deno.mkdir(freellamaHome(), { recursive: true });
  await Deno.writeTextFile(manifestPath(), JSON.stringify(manifest, null, 2) + "\n");
}

export async function getModel(
  nameOrUri: string,
): Promise<{ name: string; entry: ModelEntry } | undefined> {
  const name = normalizeName(nameOrUri);
  const manifest = await readManifest();
  const entry = manifest.models[name];
  return entry ? { name, entry } : undefined;
}

export async function addModel(name: string, entry: ModelEntry): Promise<void> {
  const manifest = await readManifest();
  manifest.models[normalizeName(name)] = entry;
  await writeManifest(manifest);
}

/** Remove a model's manifest entry and file(s). Returns the removed entry, if any. */
export async function removeModel(nameOrUri: string): Promise<ModelEntry | undefined> {
  const name = normalizeName(nameOrUri);
  const manifest = await readManifest();
  const entry = manifest.models[name];
  if (!entry) return undefined;
  delete manifest.models[name];
  await writeManifest(manifest);
  for (const file of entry.files ?? [entry.file]) {
    try {
      await Deno.remove(file);
    } catch (err) {
      if (!(err instanceof Deno.errors.NotFound)) throw err;
    }
  }
  return entry;
}

export async function listModels(): Promise<Array<{ name: string; entry: ModelEntry }>> {
  const manifest = await readManifest();
  return Object.entries(manifest.models)
    .map(([name, entry]) => ({ name, entry }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
