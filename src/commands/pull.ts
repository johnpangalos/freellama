import { formatBytes, status } from "../lib/util.ts";
import { downloadGguf, parseHfRef, progressPrinter, resolveGguf } from "../lib/hf.ts";
import { addModel, getModel, type ModelEntry } from "../lib/store.ts";
import { ensureLlamaServer } from "../lib/backend.ts";

/** Pull a model (and the llama.cpp backend). Returns the manifest entry. */
export async function pullModel(reference: string): Promise<{ name: string; entry: ModelEntry }> {
  const ref = parseHfRef(reference);
  const resolved = await resolveGguf(ref);

  const existing = await getModel(resolved.name);
  if (existing && existing.entry.sizeBytes === resolved.sizeBytes) {
    const sizes = await Promise.all(
      (existing.entry.files ?? [existing.entry.file])
        .map((f) => Deno.stat(f).then((s) => s.size).catch(() => undefined)),
    );
    // A missing or truncated part falls through to the (idempotent) downloads.
    if (
      sizes.every((s) => s !== undefined) &&
      sizes.reduce((a, b) => a + b, 0) === resolved.sizeBytes
    ) {
      return existing;
    }
  }

  const progress = progressPrinter(`pulling ${resolved.name}`);
  const localFiles: string[] = [];
  let done = 0;
  for (const part of resolved.files) {
    const offset = done;
    localFiles.push(
      await downloadGguf(
        ref.repo,
        part.remotePath,
        part.sizeBytes,
        (p) => progress({ received: offset + p.received, total: resolved.sizeBytes }),
      ),
    );
    done += part.sizeBytes;
  }
  progress();

  const entry: ModelEntry = {
    uri: resolved.uri,
    file: localFiles[0],
    ...(localFiles.length > 1 ? { files: localFiles } : {}),
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

  status("ensuring llama.cpp backend is installed...");
  await ensureLlamaServer();
  status("backend ready");
}
