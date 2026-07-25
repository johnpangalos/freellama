// Model storage: ~/.freellama/{models,bin,manifest.json}. Override the root with FREELLAMA_HOME.

import { delay } from "@std/async";
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
  const path = manifestPath();
  // Write-then-rename: rename is atomic on POSIX, so a crash mid-write leaves
  // the previous manifest intact instead of a truncated one that fails to parse.
  const tmp = `${path}.${Deno.pid}.tmp`;
  await Deno.writeTextFile(tmp, JSON.stringify(manifest, null, 2) + "\n");
  try {
    await Deno.rename(tmp, path);
  } catch (err) {
    await Deno.remove(tmp).catch(() => {});
    throw err;
  }
}

/** How long to wait for another process to release the manifest lock. */
const LOCK_TIMEOUT_MS = 10_000;
/** A lock older than this belongs to a process that died holding it. */
const LOCK_STALE_MS = 60_000;

/**
 * Run a manifest read-modify-write under an advisory lock, so two concurrent
 * `freellama pull`s cannot both read the old manifest and write back a version
 * missing the other's entry.
 */
async function withManifestLock<T>(fn: () => Promise<T>): Promise<T> {
  await Deno.mkdir(freellamaHome(), { recursive: true });
  const lock = `${manifestPath()}.lock`;
  const giveUpAt = Date.now() + LOCK_TIMEOUT_MS;
  while (true) {
    try {
      // createNew is the atomic test-and-set: exactly one process wins.
      (await Deno.open(lock, { createNew: true, write: true })).close();
      break;
    } catch (err) {
      if (!(err instanceof Deno.errors.AlreadyExists)) throw err;
      const mtime = await Deno.stat(lock).then((s) => s.mtime, () => null);
      if (mtime && Date.now() - mtime.getTime() > LOCK_STALE_MS) {
        await Deno.remove(lock).catch(() => {});
        continue;
      }
      if (Date.now() > giveUpAt) {
        throw new Error(
          `Timed out waiting for the manifest lock. If no other freellama process is running, remove ${lock}`,
        );
      }
      await delay(50);
    }
  }
  try {
    return await fn();
  } finally {
    await Deno.remove(lock).catch(() => {});
  }
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
  await withManifestLock(async () => {
    const manifest = await readManifest();
    manifest.models[normalizeName(name)] = entry;
    await writeManifest(manifest);
  });
}

/** Remove a model's manifest entry and file(s). Returns the removed entry, if any. */
export async function removeModel(nameOrUri: string): Promise<ModelEntry | undefined> {
  const name = normalizeName(nameOrUri);
  const entry = await withManifestLock(async () => {
    const manifest = await readManifest();
    const found = manifest.models[name];
    if (!found) return undefined;
    delete manifest.models[name];
    await writeManifest(manifest);
    return found;
  });
  if (!entry) return undefined;
  // The files go last, outside the lock: they are this entry's alone, and a
  // multi-gigabyte unlink should not hold up another process's manifest edit.
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
