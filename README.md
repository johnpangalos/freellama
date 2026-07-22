# freellama

A thin wrapper of [llama.cpp](https://github.com/ggml-org/llama.cpp) with an OpenAI-compatible API
built with [Deno](https://deno.com), and released into the public domain.

freellama downloads GGUF models from [Hugging Face](https://huggingface.co) and manages the official
prebuilt `llama-server` binary from llama.cpp's releases for you.

## Motivation

An easy alternative to the controverisal Ollama project. This project is meant to be an easy way to
get local AI running on your computer not backed by a VC and has no ambitions of being a real
company. Use it or don't, it's all good!

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/johnpangalos/freellama/main/install.sh | sh
```

Downloads the prebuilt binary for your platform (Linux/macOS, x64/arm64) from the
[latest release](https://github.com/johnpangalos/freellama/releases/latest) into `~/.local/bin`. Set
`FREELLAMA_INSTALL` to change the directory, or `FREELLAMA_VERSION` to pin a release. On Windows,
download `freellama-x86_64-pc-windows-msvc.zip` from the
[releases page](https://github.com/johnpangalos/freellama/releases).

### From source

Requires [Deno](https://docs.deno.com/runtime/getting_started/installation/) 2.x.

```bash
deno task install   # install `freellama` on your PATH (deno install)
deno task compile   # or build a standalone binary: ./freellama
```

## Commands

| Command                       | Description                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `pull <model>`                | Download a GGUF from Hugging Face (`hf:user/repo:QUANT` or `hf:user/repo/file.gguf`) |
| `run <model> [prompt]`        | Interactive streaming chat REPL, or a one-shot completion                            |
| `list` / `ls`                 | List installed models                                                                |
| `rm <model>`                  | Remove an installed model                                                            |
| `serve [--host H] [--port P]` | OpenAI-compatible server (default `127.0.0.1:11434`)                                 |

In the REPL: `/clear` resets the conversation, `/bye` (or Ctrl+D) exits, Ctrl+C interrupts a
response without exiting. Piping stdin (`echo "hi" | freellama run <model>`) skips the prompts and
writes only the reply, so `run` composes in shell pipelines.

## OpenAI-compatible server

```bash
freellama serve
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
requesting a different model swaps the loaded one (in-flight responses are drained first, up to 30
s).

The server has no authentication. It binds `127.0.0.1` by default; if you pass `--host 0.0.0.0` (or
any non-loopback address), anyone who can reach the port can run inference on your machine — put it
behind a reverse proxy or firewall first.

### How about an example?

```python
from openai import OpenAI

client = OpenAI(base_url="http://127.0.0.1:11434/v1", api_key="unused")
reply = client.chat.completions.create(
    model="Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M",
    messages=[{"role": "user", "content": "Hi"}],
)
```

## Configuration

| Variable                  | Purpose                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `FREELLAMA_HOME`          | Data directory (default `~/.freellama`)                              |
| `FREELLAMA_CTX`           | Context size passed to llama-server (default `4096`)                 |
| `FREELLAMA_BACKEND`       | llama.cpp build variant: `vulkan`, `cuda`, `rocm`, ... (default CPU) |
| `FREELLAMA_LLAMA_VERSION` | Pin a llama.cpp release tag, e.g. `b5900` (default: latest)          |
| `FREELLAMA_LLAMA_SERVER`  | Path to an existing `llama-server` binary (skips downloads)          |
| `FREELLAMA_SERVER_ARGS`   | Extra flags passed through to `llama-server`                         |
| `FREELLAMA_READY_TIMEOUT` | Seconds to wait for llama-server to load a model (default `180`)     |
| `FREELLAMA_DEBUG=1`       | Show llama-server output for troubleshooting                         |
| `HF_TOKEN`                | Hugging Face token for gated model repos                             |

`FREELLAMA_BACKEND` picks the matching GPU build from llama.cpp's prebuilt releases (e.g.
`FREELLAMA_BACKEND=vulkan` for AMD/Intel GPUs, `cuda` for NVIDIA on Windows). Combine it with
`FREELLAMA_SERVER_ARGS` to offload work onto the GPU, e.g. `FREELLAMA_SERVER_ARGS="-ngl 99 -fa on"`.
Interrupted model downloads resume where they left off when you re-run `pull`.

Models are stored in `~/.freellama/models`, llama.cpp binaries in `~/.freellama/bin/<tag>` (GPU
variants in `~/.freellama/bin/<tag>-<backend>`).

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

I generated this code with AI, I might as well pay it forward. I make no claims of intelectual
property beyond purchasing a claude subscription.
