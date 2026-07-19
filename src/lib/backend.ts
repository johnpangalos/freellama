// llama.cpp backend manager: downloads the official prebuilt llama-server binary
// from ggml-org/llama.cpp GitHub releases into ~/.freellama/bin/<tag>/.
//
// freellama runs inference exclusively through llama.cpp (MIT licensed,
// (c) The ggml authors) — see THIRD_PARTY_NOTICES.md.

import { dirname, join } from "node:path";
import { unzipSync } from "fflate";
import { binDir } from "./store.ts";
import { progressPrinter } from "./hf.ts";

const RELEASES_API = "https://api.github.com/repos/ggml-org/llama.cpp/releases";

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface Release {
  tag_name: string;
  assets: ReleaseAsset[];
}

function githubHeaders(): HeadersInit {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  const token = Deno.env.get("GITHUB_TOKEN");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

const GPU_TOKENS = ["cuda", "vulkan", "hip", "rocm", "sycl", "kompute", "opencl"];

/**
 * Pick the best CPU/Metal release asset for an OS/arch. Asset names look like
 * "llama-b5900-bin-ubuntu-x64.zip", "llama-b5900-bin-macos-arm64.zip",
 * "llama-b5900-bin-win-cpu-x64.zip". Exported for tests.
 */
export function pickAsset(
  assets: ReleaseAsset[],
  os: typeof Deno.build.os,
  arch: typeof Deno.build.arch,
): ReleaseAsset | undefined {
  const osToken = os === "darwin" ? "macos" : os === "windows" ? "win" : "ubuntu";
  const archToken = arch === "aarch64" ? "arm64" : "x64";
  const candidates = assets.filter((a) => {
    const n = a.name.toLowerCase();
    return n.endsWith(".zip") && n.includes("-bin-") && n.includes(osToken) &&
      n.includes(archToken);
  });
  const score = (a: ReleaseAsset): number => {
    const n = a.name.toLowerCase();
    let s = 0;
    if (n.includes("cpu")) s += 2;
    for (const gpu of GPU_TOKENS) if (n.includes(gpu)) s -= 5;
    return s;
  };
  return candidates.sort((a, b) => score(b) - score(a))[0];
}

async function fetchRelease(version: string): Promise<Release> {
  const url = version === "latest" ? `${RELEASES_API}/latest` : `${RELEASES_API}/tags/${version}`;
  const resp = await fetch(url, { headers: githubHeaders() });
  if (!resp.ok) {
    throw new Error(
      `Failed to query llama.cpp release "${version}" (HTTP ${resp.status}). ` +
        `Check network access to api.github.com, or set FREELLAMA_LLAMA_VERSION to a specific tag.`,
    );
  }
  return (await resp.json()) as Release;
}

async function findInstalled(): Promise<string | undefined> {
  const exe = Deno.build.os === "windows" ? "llama-server.exe" : "llama-server";
  try {
    const tags: string[] = [];
    for await (const entry of Deno.readDir(binDir())) {
      if (entry.isDirectory) tags.push(entry.name);
    }
    // Rolling llama.cpp tags ("b5900") sort correctly by numeric part.
    tags.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const tag of tags) {
      const found = await findFile(join(binDir(), tag), exe);
      if (found) return found;
    }
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }
  return undefined;
}

async function findFile(dir: string, name: string): Promise<string | undefined> {
  try {
    for await (const entry of Deno.readDir(dir)) {
      const path = join(dir, entry.name);
      if (entry.isFile && entry.name === name) return path;
      if (entry.isDirectory) {
        const found = await findFile(path, name);
        if (found) return found;
      }
    }
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }
  return undefined;
}

/**
 * Ensure a llama-server binary is available locally, downloading the pinned
 * (or latest) llama.cpp release if needed. Returns the absolute binary path.
 *
 * Set FREELLAMA_LLAMA_VERSION to pin a release tag (e.g. "b5900");
 * FREELLAMA_LLAMA_SERVER to point at an existing llama-server binary and skip
 * downloads entirely.
 */
export async function ensureLlamaServer(): Promise<string> {
  const explicit = Deno.env.get("FREELLAMA_LLAMA_SERVER");
  if (explicit) return explicit;

  const version = Deno.env.get("FREELLAMA_LLAMA_VERSION") ?? "latest";
  const exe = Deno.build.os === "windows" ? "llama-server.exe" : "llama-server";

  // Without an explicit pin, reuse whatever is already installed before going online.
  if (version === "latest") {
    const installed = await findInstalled();
    if (installed) return installed;
  } else {
    const existing = await findFile(join(binDir(), version), exe);
    if (existing) return existing;
  }

  const release = await fetchRelease(version);
  const asset = pickAsset(release.assets, Deno.build.os, Deno.build.arch);
  if (!asset) {
    throw new Error(
      `No prebuilt llama.cpp binary for ${Deno.build.os}/${Deno.build.arch} in release ${release.tag_name}. ` +
        `Build llama.cpp yourself and set FREELLAMA_LLAMA_SERVER to the llama-server path.`,
    );
  }

  const installDir = join(binDir(), release.tag_name);
  const progress = progressPrinter(`downloading llama.cpp ${release.tag_name} (${asset.name})`);
  const resp = await fetch(asset.browser_download_url, { headers: githubHeaders() });
  if (!resp.ok || !resp.body) {
    throw new Error(`Failed to download ${asset.name}: HTTP ${resp.status}`);
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  for await (const chunk of resp.body) {
    chunks.push(chunk);
    received += chunk.byteLength;
    progress({ received, total: asset.size });
  }
  progress();

  const zip = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    zip.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const entries = unzipSync(zip);
  for (const [path, data] of Object.entries(entries)) {
    if (path.endsWith("/")) continue;
    const dest = join(installDir, path);
    await Deno.mkdir(dirname(dest), { recursive: true });
    await Deno.writeFile(dest, data);
    if (Deno.build.os !== "windows") {
      // fflate does not surface zip permission bits; mark everything executable.
      await Deno.chmod(dest, 0o755);
    }
  }

  const server = await findFile(installDir, exe);
  if (!server) {
    throw new Error(`llama-server not found inside ${asset.name} after extraction`);
  }
  return server;
}
