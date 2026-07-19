# freellama

Run LLMs locally with an Ollama-style CLI and an OpenAI-compatible API — powered by
[llama.cpp](https://github.com/ggml-org/llama.cpp), built with [Deno](https://deno.com), and
released into the public domain.

freellama downloads GGUF models straight from [Hugging Face](https://huggingface.co) and manages the
official prebuilt `llama-server` binary from llama.cpp's releases for you. No registry, no account,
no telemetry.

## Quick start

Requires [Deno](https://docs.deno.com/runtime/getting_started/installation/) 2.x.

```bash
# download a small model (~400 MB) from Hugging Face
deno task dev pull hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M

# chat with it
deno task dev run Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M

# or one-shot
deno task dev run Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M "Say hello in five words"
```

Build a standalone binary with `deno task compile`, then use `./freellama` directly.

## Commands

| Command                       | Description                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `pull <model>`                | Download a GGUF from Hugging Face (`hf:user/repo:QUANT` or `hf:user/repo/file.gguf`) |
| `run <model> [prompt]`        | Interactive streaming chat REPL, or a one-shot completion                            |
| `list` / `ls`                 | List installed models                                                                |
| `rm <model>`                  | Remove an installed model                                                            |
| `serve [--host H] [--port P]` | OpenAI-compatible server (default `127.0.0.1:11434`)                                 |

In the REPL: `/clear` resets the conversation, `/bye` (or Ctrl+D) exits, Ctrl+C interrupts a
response without exiting.

## OpenAI-compatible server

```bash
deno task dev serve
```

Then point any OpenAI client at it (the API key can be anything):

```bash
curl http://127.0.0.1:11434/v1/models

curl http://127.0.0.1:11434/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M",
    "messages": [{"role": "user", "content": "Hi"}]
  }'
```

Streaming works via `"stream": true` (server-sent events, terminated by `data: [DONE]`). Requests
are proxied to a `llama-server` subprocess that is started lazily for the requested model;
requesting a different model swaps the loaded one.

```python
from openai import OpenAI

client = OpenAI(base_url="http://127.0.0.1:11434/v1", api_key="unused")
reply = client.chat.completions.create(
    model="Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M",
    messages=[{"role": "user", "content": "Hi"}],
)
```

## Configuration

| Variable                  | Purpose                                                     |
| ------------------------- | ----------------------------------------------------------- |
| `FREELLAMA_HOME`          | Data directory (default `~/.freellama`)                     |
| `FREELLAMA_CTX`           | Context size passed to llama-server (default `4096`)        |
| `FREELLAMA_LLAMA_VERSION` | Pin a llama.cpp release tag, e.g. `b5900` (default: latest) |
| `FREELLAMA_LLAMA_SERVER`  | Path to an existing `llama-server` binary (skips downloads) |
| `FREELLAMA_SERVER_ARGS`   | Extra flags passed through to `llama-server`                |
| `FREELLAMA_DEBUG=1`       | Show llama-server output for troubleshooting                |
| `HF_TOKEN`                | Hugging Face token for gated model repos                    |

Models are stored in `~/.freellama/models`, llama.cpp binaries in `~/.freellama/bin/<tag>`.

## Development

```bash
deno task test     # unit + integration tests (uses a fake llama-server; no downloads)
deno task check    # type-check, lint, format check
deno task compile  # build the standalone binary
```

## Credits

- **[llama.cpp](https://github.com/ggml-org/llama.cpp)** by Georgi Gerganov and the ggml authors
  (MIT license) does all of the actual inference. freellama is a thin manager around the official
  `llama-server` binaries from llama.cpp's releases — please star and support that project.
- **[Ollama](https://github.com/ollama/ollama)** (MIT license) inspired the CLI experience.
  freellama shares no code with Ollama and does not use Ollama's registry or services.
- Model weights are downloaded from **[Hugging Face](https://huggingface.co)**; each model is
  covered by its own license, which you accept by downloading and using it.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for full license texts.

freellama is an independent project. It is not affiliated with, sponsored by, or endorsed by Ollama
Inc., the llama.cpp project, Meta Platforms, or Hugging Face.

## License

freellama itself is released into the public domain under [The Unlicense](LICENSE). The llama.cpp
binaries it downloads, and the models you pull, keep their own licenses.
