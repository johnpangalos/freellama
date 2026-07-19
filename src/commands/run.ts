import { TextLineStream } from "@std/streams";
import { status } from "../lib/util.ts";
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
    status(`model not found locally, pulling ${reference}...`);
    model = await pullModel(reference);
  }

  const serverBin = await ensureLlamaServer();
  status(`loading ${model.name}...`);
  const handle = await startLlamaServer({ serverBin, modelPath: model.entry.file });

  let stopping = false;
  const stopServer = async () => {
    if (stopping) return;
    stopping = true;
    await handle.stop();
  };
  // Explicit exit: the SIGINT listener and the stdin reader keep the event
  // loop alive, so the process would hang if we just returned.
  const stop = async (code: number) => {
    await stopServer();
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

    // Interactive tty gets prompts and a banner; piped stdin (echo ... | freellama run)
    // runs clean so stdout is just the model's replies.
    const interactive = Deno.stdin.isTerminal();
    if (interactive) {
      status(`\n${model.name} ready. Type a message, /clear to reset, /bye to exit.\n`);
    }
    const history: ChatMessage[] = [];
    const lines = Deno.stdin.readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new TextLineStream())[Symbol.asyncIterator]();

    while (true) {
      if (interactive) print(">>> ");
      const { value: line, done } = await lines.next();
      if (done || line === undefined) break; // Ctrl+D / EOF
      const input = line.trim();
      if (input === "") continue;
      if (input === "/bye" || input === "/exit") break;
      if (input === "/clear") {
        history.length = 0;
        status("(history cleared)");
        continue;
      }

      history.push({ role: "user", content: input });
      const result = await chatTurn(handle, model.name, history, (c) => abort = c);
      print("\n\n");
      if (result.finishReason === "abort") {
        status("(generation interrupted)");
      }
      history.push({ role: "assistant", content: result.content });
    }
  } catch (err) {
    // Stop the backend but rethrow so cli.ts reports the error and exits
    // non-zero — a `stop(0)` here would swallow the failure.
    await stopServer();
    throw err;
  } finally {
    abort = undefined;
  }
  await stop(0);
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
