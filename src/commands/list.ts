import { formatBytes } from "../lib/util.ts";
import { listModels } from "../lib/store.ts";

export async function listCommand(_args: string[]): Promise<void> {
  const models = await listModels();
  if (models.length === 0) {
    console.log(
      "No models installed. Try: freellama pull hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M",
    );
    return;
  }

  const rows = await Promise.all(models.map(async ({ name, entry }) => {
    let size = formatBytes(entry.sizeBytes);
    try {
      await Deno.stat(entry.file);
    } catch {
      size = "missing!";
    }
    return { name, size, modified: entry.pulledAt.slice(0, 16).replace("T", " ") };
  }));

  const nameWidth = Math.max(4, ...rows.map((r) => r.name.length));
  const sizeWidth = Math.max(4, ...rows.map((r) => r.size.length));
  console.log(`${"NAME".padEnd(nameWidth)}  ${"SIZE".padEnd(sizeWidth)}  PULLED`);
  for (const r of rows) {
    console.log(`${r.name.padEnd(nameWidth)}  ${r.size.padEnd(sizeWidth)}  ${r.modified}`);
  }
}
