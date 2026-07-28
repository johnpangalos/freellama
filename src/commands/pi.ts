import { parseArgs } from "@std/cli/parse-args";
import { dirname } from "@std/path";
import { status } from "../lib/util.ts";
import { listModels } from "../lib/store.ts";
import {
  buildPiProvider,
  contextWindow,
  mergePiConfig,
  PI_PROVIDER,
  piConfigPath,
} from "../lib/pi.ts";

export async function piConfigCommand(args: string[]): Promise<void> {
  const flags = parseArgs(args, {
    boolean: ["write"],
    string: ["host", "port"],
    default: { host: "127.0.0.1", port: "11434" },
  });
  const port = Number(flags.port);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid port "${flags.port}"`);
  }

  const models = await listModels();
  if (models.length === 0) {
    throw new Error(
      "No models installed. Pull one first, e.g. freellama pull hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M",
    );
  }

  const ctx = contextWindow();
  const provider = buildPiProvider(
    `http://${flags.host}:${port}/v1`,
    models.map((m) => m.name),
    ctx,
  );
  const path = piConfigPath();

  if (!flags.write) {
    // The snippet is data, so `freellama pi-config > provider.json` works.
    console.log(JSON.stringify({ providers: { [PI_PROVIDER]: provider } }, null, 2));
    status(`\n${models.length} model(s), context ${ctx}.`);
    status(`Merge into ${path}, or re-run with --write to do it automatically.`);
    return;
  }

  let existing: string | undefined;
  try {
    existing = await Deno.readTextFile(path);
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }
  await Deno.mkdir(dirname(path), { recursive: true });
  await Deno.writeTextFile(path, mergePiConfig(existing, provider));

  status(`wrote "${PI_PROVIDER}" provider (${models.length} model(s), context ${ctx}) to ${path}`);
  status(`\nStart the server, then point pi at it:`);
  status(`  freellama serve`);
  status(`  pi --provider ${PI_PROVIDER} --model ${models[0].name}`);
}
