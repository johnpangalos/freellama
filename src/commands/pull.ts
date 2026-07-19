import { formatBytes } from "../lib/util.ts";
import { downloadGguf, parseHfRef, progressPrinter, resolveGguf } from "../lib/hf.ts";
import { addModel, getModel, type ModelEntry } from "../lib/store.ts";
import { ensureLlamaServer } from "../lib/backend.ts";

/** Pull a model (and the llama.cpp backend). Returns the manifest entry. */
export async function pullModel(reference: string): Promise<{ name: string; entry: ModelEntry }> {
  const ref = parseHfRef(reference);
  const resolved = await resolveGguf(ref);

  const existing = await getModel(resolved.name);
  if (existing && existing.entry.sizeBytes === resolved.sizeBytes) {
    try {
      const stat = await Deno.stat(existing.entry.file);
      if (stat.size === resolved.sizeBytes) return existing;
    } catch {
      // File missing — re-download below.
    }
  }

  const progress = progressPrinter(`pulling ${resolved.name}`);
  const file = await downloadGguf(ref.repo, resolved.remotePath, resolved.sizeBytes, progress);
  progress();

  const entry: ModelEntry = {
    uri: resolved.uri,
    file,
    sizeBytes: resolved.sizeBytes,
    pulledAt: new Date().toISOString(),
  };
  await addModel(resolved.name, entry);
  return { name: resolved.name, entry };
}

export async function pullCommand(args: string[]): Promise<void> {
  const reference = args[0];
  if (!reference) {
    throw new Error("Usage: freellama pull <hf:user/repo:QUANT | hf:user/repo/file.gguf>");
  }
  const { name, entry } = await pullModel(reference);
  console.log(`pulled ${name} (${formatBytes(entry.sizeBytes)})`);

  console.error("ensuring llama.cpp backend is installed...");
  await ensureLlamaServer();
  console.error("backend ready");
}
