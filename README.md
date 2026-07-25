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

| Command                                 | Description                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| `pull <model>`                          | Download a GGUF from Hugging Face (`hf:user/repo:QUANT` or `hf:user/repo/file.gguf`) |
| `run [--ctx N] <model> [prompt]`        | Interactive streaming chat REPL, or a one-shot completion                            |
| `list` / `ls`                           | List installed models                                                                |
| `rm <model>`                            | Remove an installed model                                                            |
| `serve [--host H] [--port P] [--ctx N]` | OpenAI-compatible server (default `127.0.0.1:11434`)                                 |
| `upgrade`                               | Install the latest llama.cpp backend release                                         |

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

### Anthropic-compatible endpoints

The same server also speaks the Anthropic Messages API — `POST /v1/messages` (streaming and not) and
`POST /v1/messages/count_tokens` — because llama.cpp implements that format natively. Point any
Anthropic client at it with `ANTHROPIC_BASE_URL`:

```bash
curl http://127.0.0.1:11434/v1/messages \
  -H 'Content-Type: application/json' \
  -H 'anthropic-version: 2023-06-01' \
  -d '{
    "model": "Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M",
    "max_tokens": 256,
    "messages": [{"role": "user", "content": "Hi"}]
  }'
```

`x-api-key` and `anthropic-version` are forwarded upstream but nothing checks them — the key can be
anything. This is what makes Claude Code work against a local model; see
[Running Claude Code locally](#running-claude-code-locally).

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

| Variable                  | Purpose                                                      |
| ------------------------- | ------------------------------------------------------------ |
| `FREELLAMA_HOME`          | Data directory (default `~/.freellama`)                      |
| `FREELLAMA_CTX`           | Context size passed to llama-server (default `32768`)        |
| `FREELLAMA_LLAMA_VERSION` | Pin a llama.cpp release tag, e.g. `b5900`                    |
| `FREELLAMA_LLAMA_SERVER`  | Path to an existing `llama-server` binary (skips downloads)  |
| `FREELLAMA_SERVER_ARGS`   | Extra flags passed through to `llama-server` (shell quoting) |
| `FREELLAMA_DEBUG=1`       | Show llama-server output for troubleshooting                 |
| `HF_TOKEN`                | Hugging Face token for gated model repos                     |

`FREELLAMA_SERVER_ARGS` is split the way a shell would: whitespace separates arguments, and single
or double quotes group a value that contains spaces.

```bash
FREELLAMA_SERVER_ARGS='--flash-attn --chat-template "my template"' freellama serve
```

Models are stored in `~/.freellama/models`, llama.cpp binaries in `~/.freellama/bin/<tag>`.

### Context size

The default context window is 32768 tokens, sized for agents rather than chat — a coding agent's
system prompt alone can run 20–30k tokens. Set it per invocation with `--ctx`, or globally with
`FREELLAMA_CTX`:

```bash
freellama serve --ctx 65536      # a bigger window
freellama run --ctx 8192 <model> # a smaller one, for a memory-constrained machine
freellama serve --ctx 0          # whatever context the model was trained for
```

The KV cache grows linearly with the context size, and it is per-model: a 30B-class model at 32k
costs several GB of RAM/VRAM on top of the weights. If the model fails to load, or loading pushes
your machine into swap, lower `--ctx` first. Quantizing the KV cache trades a little quality for
roughly half the cache memory and lets a large context fit where it otherwise wouldn't:

```bash
FREELLAMA_SERVER_ARGS='--cache-type-k q8_0 --cache-type-v q8_0' freellama serve
```

`--ctx 0` hands the decision to llama-server, which reads the model's trained context from the GGUF
metadata. That is the most correct answer and the most dangerous one: a model trained for 256k
tokens will try to allocate a KV cache to match.

### Upgrading the llama.cpp backend

The first command that needs `llama-server` downloads the latest llama.cpp release; every command
after that reuses the installed one, so no run surprises you with a fresh multi-hundred-megabyte
build (or a llama.cpp regression) mid-session. To move to a newer release:

```bash
freellama upgrade
```

That resolves the latest release (or the tag in `FREELLAMA_LLAMA_VERSION`) and installs it beside
the current one under `~/.freellama/bin/<tag>`. The previous build is left in place — delete its
directory when you're happy with the new one. `FREELLAMA_LLAMA_SERVER` opts out of all of this and
points freellama at a build you manage yourself.

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
