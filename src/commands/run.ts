import { LineStream } from "../lib/util.ts";
import { getModel } from "../lib/store.ts";
import { ensureLlamaServer } from "../lib/backend.ts";
import { type LlamaServerHandle, startLlamaServer } from "../lib/runner.ts";
import { type ChatMessage, streamChat } from "../lib/openai.ts";
import { pullModel } from "./pull.ts";

const encoder = new TextEncoder();

function print(text: string) {
  Deno.stdout.writeSync(encoder.encode(text));
}

export async function runCommand(args: string[]): Promise<void> {
  const reference = args[0];
  if (!reference) throw new Error('Usage: freellama run <model> ["one-shot prompt"]');
  const oneShot = args.slice(1).join(" ").trim() || undefined;

  let model = await getModel(reference);
  if (!model) {
    console.error(`model not found locally, pulling ${reference}...`);
    model = await pullModel(reference);
  }

  const serverBin = await ensureLlamaServer();
  console.error(`loading ${model.name}...`);
  const handle = await startLlamaServer({ serverBin, modelPath: model.entry.file });

  let stopping = false;
  const stop = async (code: number) => {
    if (stopping) return;
    stopping = true;
    await handle.stop();
    Deno.exit(code);
  };

  let abort: AbortController | undefined;
  Deno.addSignalListener("SIGINT", () => {
    if (abort) {
      abort.abort();
    } else {
      print("\n");
      stop(0);
    }
  });

  try {
    if (oneShot) {
      await chatTurn(handle, model.name, [{ role: "user", content: oneShot }], (c) => abort = c);
      print("\n");
      await stop(0);
      return;
    }

    console.error(`\n${model.name} ready. Type a message, /clear to reset, /bye to exit.\n`);
    const history: ChatMessage[] = [];
    const lines = Deno.stdin.readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new LineStream())[Symbol.asyncIterator]();

    while (true) {
      print(">>> ");
      const { value: line, done } = await lines.next();
      if (done || line === undefined) break; // Ctrl+D / EOF
      const input = line.trim();
      if (input === "") continue;
      if (input === "/bye" || input === "/exit") break;
      if (input === "/clear") {
        history.length = 0;
        console.error("(history cleared)");
        continue;
      }

      history.push({ role: "user", content: input });
      const result = await chatTurn(handle, model.name, history, (c) => abort = c);
      print("\n\n");
      if (result.finishReason === "abort") {
        console.error("(generation interrupted)");
      }
      history.push({ role: "assistant", content: result.content });
    }
  } finally {
    abort = undefined;
    await stop(0);
  }
}

async function chatTurn(
  handle: LlamaServerHandle,
  model: string,
  messages: ChatMessage[],
  setAbort: (c: AbortController | undefined) => void,
) {
  const controller = new AbortController();
  setAbort(controller);
  try {
    return await streamChat(handle.baseUrl, model, messages, print, controller.signal);
  } finally {
    setAbort(undefined);
  }
}
