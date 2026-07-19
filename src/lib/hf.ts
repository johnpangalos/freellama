// Hugging Face GGUF resolution and download.
// Accepted references (with or without the "hf:" prefix):
//   hf:user/repo:QUANT          — pick the single .gguf matching the quant label
//   hf:user/repo/path/file.gguf — exact file within the repo
//   hf:user/repo                — error listing the available quants

import { basename, join } from "@std/path";
import { formatBytes } from "./util.ts";
import { modelsDir, normalizeName, toUri } from "./store.ts";

const HF_BASE = "https://huggingface.co";

export interface HfRef {
  /** "user/repo" */
  repo: string;
  quant?: string;
  /** Path of a specific .gguf inside the repo. */
  file?: string;
}

export function parseHfRef(input: string): HfRef {
  const name = normalizeName(input.trim());
  const match = name.match(/^([\w.-]+\/[\w.-]+)(?:(\/[\w./ -]+\.gguf)|:([\w.-]+))?$/i);
  if (!match) {
    throw new Error(
      `Invalid model reference "${input}". Expected hf:user/repo:QUANT or hf:user/repo/file.gguf`,
    );
  }
  const [, repo, file, quant] = match;
  return { repo, file: file?.slice(1), quant };
}

/** Canonical user-facing name for a parsed reference. */
export function refToName(ref: HfRef): string {
  if (ref.file) return `${ref.repo}/${ref.file}`;
  if (ref.quant) return `${ref.repo}:${ref.quant}`;
  return ref.repo;
}

interface HfTreeEntry {
  type: string;
  path: string;
  size: number;
}

function authHeaders(): HeadersInit {
  const token = Deno.env.get("HF_TOKEN");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function listRepoFiles(repo: string): Promise<HfTreeEntry[]> {
  const url = `${HF_BASE}/api/models/${repo}/tree/main?recursive=true`;
  const resp = await fetch(url, { headers: authHeaders() });
  if (resp.status === 401 || resp.status === 403) {
    throw new Error(
      `Access to ${repo} denied (HTTP ${resp.status}). For gated models, set HF_TOKEN and accept the model's license on huggingface.co.`,
    );
  }
  if (resp.status === 404) {
    throw new Error(`Model repo "${repo}" not found on Hugging Face`);
  }
  if (!resp.ok) {
    throw new Error(`Failed to list files of ${repo}: HTTP ${resp.status}`);
  }
  return (await resp.json()) as HfTreeEntry[];
}

/** Resolve a reference to the exact file to download. */
export async function resolveGguf(
  ref: HfRef,
): Promise<{ remotePath: string; sizeBytes: number; name: string; uri: string }> {
  const files = await listRepoFiles(ref.repo);
  const ggufs = files.filter((f) => f.type === "file" && f.path.toLowerCase().endsWith(".gguf"));
  if (ggufs.length === 0) {
    throw new Error(`No .gguf files found in ${ref.repo}`);
  }

  let chosen: HfTreeEntry | undefined;
  if (ref.file) {
    chosen = ggufs.find((f) => f.path === ref.file);
    if (!chosen) {
      throw new Error(
        `File "${ref.file}" not found in ${ref.repo}. Available:\n${ggufList(ggufs)}`,
      );
    }
  } else if (ref.quant) {
    const quant = ref.quant.toLowerCase();
    const matches = ggufs.filter((f) => {
      const base = basename(f.path).toLowerCase();
      return base.includes(`-${quant}.gguf`) || base.includes(`.${quant}.gguf`) ||
        base.includes(`_${quant}.gguf`) || base.includes(quant);
    });
    if (matches.length === 0) {
      throw new Error(
        `No .gguf matching quant "${ref.quant}" in ${ref.repo}. Available:\n${ggufList(ggufs)}`,
      );
    }
    // Prefer exact "-QUANT.gguf" suffix matches over loose substring hits.
    chosen = matches.find((f) => basename(f.path).toLowerCase().endsWith(`-${quant}.gguf`)) ??
      matches[0];
  } else {
    throw new Error(
      `Specify a quant or file for ${ref.repo}. Available:\n${ggufList(ggufs)}\n` +
        `Example: freellama pull hf:${ref.repo}:${guessQuant(ggufs)}`,
    );
  }

  if (/-\d{5}-of-\d{5}\.gguf$/i.test(chosen.path)) {
    throw new Error(
      `"${chosen.path}" is a split (multi-part) GGUF, which freellama does not support yet. Pick a single-file quant.`,
    );
  }

  const name = refToName(ref);
  return { remotePath: chosen.path, sizeBytes: chosen.size, name, uri: toUri(name) };
}

function ggufList(files: HfTreeEntry[]): string {
  return files.map((f) => `  - ${f.path} (${formatBytes(f.size)})`).join("\n");
}

function guessQuant(files: HfTreeEntry[]): string {
  const match = files.map((f) => basename(f.path).match(/-(q\d[\w.]*)\.gguf$/i)).find(Boolean);
  return match?.[1]?.toUpperCase() ?? "Q4_K_M";
}

/** Local file path a remote GGUF is stored at. */
export function localPathFor(repo: string, remotePath: string): string {
  const safe = `${repo}/${remotePath}`.replaceAll("/", "__");
  return join(modelsDir(), safe);
}

export interface DownloadProgress {
  received: number;
  total: number | undefined;
}

/**
 * Download a GGUF to the models directory. Idempotent: skips the download when the
 * file already exists with the expected size. Returns the local path.
 */
export async function downloadGguf(
  repo: string,
  remotePath: string,
  expectedSize: number,
  onProgress?: (p: DownloadProgress) => void,
): Promise<string> {
  const dest = localPathFor(repo, remotePath);
  try {
    const stat = await Deno.stat(dest);
    if (stat.size === expectedSize) return dest;
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }

  await Deno.mkdir(modelsDir(), { recursive: true });
  const url = `${HF_BASE}/${repo}/resolve/main/${remotePath}?download=true`;
  const resp = await fetch(url, { headers: authHeaders() });
  if (!resp.ok || !resp.body) {
    throw new Error(`Download failed: HTTP ${resp.status} for ${url}`);
  }
  const total = Number(resp.headers.get("content-length")) || expectedSize || undefined;

  const tmp = dest + ".partial";
  let received = 0;
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      onProgress?.({ received, total });
      controller.enqueue(chunk);
    },
  });
  const file = await Deno.open(tmp, { write: true, create: true, truncate: true });
  await resp.body.pipeThrough(counter).pipeTo(file.writable);
  // A cleanly-closed-but-truncated response must not be recorded as a valid model.
  if (expectedSize > 0 && received !== expectedSize) {
    await Deno.remove(tmp).catch(() => {});
    throw new Error(
      `Download of ${remotePath} incomplete: got ${formatBytes(received)}, expected ${
        formatBytes(expectedSize)
      }. Try again.`,
    );
  }
  await Deno.rename(tmp, dest);
  return dest;
}

/** Render a one-line progress bar to stderr; call with undefined to finish the line. */
export function progressPrinter(label: string): (p?: DownloadProgress) => void {
  let lastRender = 0;
  let last: DownloadProgress | undefined;
  const encoder = new TextEncoder();
  const render = (p: DownloadProgress) => {
    const pct = p.total ? ` ${Math.floor((p.received / p.total) * 100)}%` : "";
    const totalStr = p.total ? ` / ${formatBytes(p.total)}` : "";
    Deno.stderr.writeSync(
      encoder.encode(`\r${label}:${pct} ${formatBytes(p.received)}${totalStr}   `),
    );
  };
  return (p?: DownloadProgress) => {
    if (!p) {
      // Finish: render the final numbers unthrottled (so the line ends at 100%,
      // not wherever the throttle left it), then end the line. If nothing was
      // ever reported (download skipped), print nothing.
      if (!last) return;
      render(last);
      Deno.stderr.writeSync(encoder.encode("\n"));
      return;
    }
    last = p;
    const now = Date.now();
    if (now - lastRender < 100) return;
    lastRender = now;
    render(p);
  };
}
