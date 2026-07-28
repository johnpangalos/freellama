---
name: handoff
description: Hand the current task off to a local model. Writes a self-contained context bundle to .freellama/handoffs/ and runs the pi coding agent against `freellama serve`. Use when the user wants to continue work locally, offload a task to a local model, or asks to "hand this off", "send this to the local model", or "run this with pi".
---

# Handoff to a local model

Package what you currently know into a bundle a local model can act on without you, then start `pi`
against `freellama serve`.

The whole point is that the local model has **none** of this conversation. It is also substantially
weaker than you. Both facts drive everything below: the bundle has to be self-contained, and the
task has to be small enough to survive a weaker model.

## 1. Scope the task honestly

Before writing anything, decide whether this is a good handoff. Good candidates are mechanical and
verifiable: applying a decided-on refactor across files, filling in tests for a settled interface,
renaming things, writing boilerplate from a clear spec.

Bad candidates are open-ended design, anything needing conversation history to disambiguate, and
anything where a wrong answer is expensive and hard to spot.

If the task is a bad candidate, say so and ask before proceeding. Do not silently hand off something
that will come back wrong.

## 2. Write the bundle

Create the directory (from the repo root):

```bash
mkdir -p ".freellama/handoffs/$(date -u +%Y%m%dT%H%M%SZ)-<short-slug>"
```

Use a short kebab-case slug describing the task. `.freellama/` is gitignored, so bundles stay local.

Write `context.md` inside it with exactly these sections:

```markdown
# <one-line task title>

## Task

What to do, imperative and concrete. One paragraph at most. If there is more than one deliverable,
this is too big — split it.

## Repo

Where the work happens: the repo root, the language/runtime, the commands to build, test, and lint.

## Files

Each file that matters, with an absolute or repo-relative path and one line on why it matters.
Include files to read for context, not just files to edit — mark which is which.

## What's already done

State of play. Anything already tried and rejected, so the model doesn't redo it.

## Constraints

Project conventions that apply, from CLAUDE.md or the surrounding code. Be specific: "use @std/path,
not node:path" beats "follow conventions".

## Definition of done

The exact command(s) that must pass, and what the output should look like.
```

Rules for the content:

- **No references to this conversation.** No "as we discussed", "the approach above", "the file you
  mentioned". Every reference must resolve inside the bundle or the repo.
- **Paths, not descriptions.** `src/lib/store.ts:67` beats "the model lookup function".
- **Inline short snippets** the model needs (an interface, a signature, an error message). Don't
  make it hunt.
- **Name the verification command.** A local model that can run `deno task test` can self-correct;
  one that can't will guess.

Then show the user the bundle path and a one-line summary of what you wrote before running anything.

## 3. Make sure the server is up

`pi` talks to `freellama serve`, which must already be running — pi will not start it.

```bash
curl -sf http://127.0.0.1:11434/health || echo "not running"
```

If it isn't running, start it in a background shell and wait for it to answer before continuing:

```bash
freellama serve
```

The first request for a given model loads it, which can take a while on a cold start. That is
expected.

## 4. Make sure pi knows about freellama

One-time setup, only if `~/.pi/agent/models.json` has no `freellama` provider:

```bash
freellama pi-config --write
```

This writes one provider entry built from the installed models, with `contextWindow` set from
`FREELLAMA_CTX` so pi doesn't overflow the KV cache. Re-run it after pulling or removing models. It
merges — other providers in that file are left alone.

## 5. Run it

Pick a model with `freellama list`. Prefer an instruction-tuned model large enough for the task;
tiny models are fine for mechanical edits and bad at anything else.

Interactive (the user drives from here):

```bash
pi --provider freellama --model <model> @.freellama/handoffs/<id>/context.md "<task title>"
```

Headless, when the user wants the result rather than a session:

```bash
pi -p --provider freellama --model <model> @.freellama/handoffs/<id>/context.md "<task title>"
```

Hand control back to the user once pi is running. Don't narrate its output.

## Notes

- `pi` also auto-discovers `CLAUDE.md`/`AGENTS.md` from the working directory upward, so project
  conventions load on their own. The `## Constraints` section is for the subset that actually
  applies to this task — keep it short rather than restating the whole file.
- Keep bundles around. When a handoff comes back wrong, the bundle is the evidence of what the model
  was actually told, and is usually where the bug is.
