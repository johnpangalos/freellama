// llama.cpp backend manager: downloads the official prebuilt llama-server binary
// from ggml-org/llama.cpp GitHub releases into ~/.freellama/bin/<tag>/.
//
// freellama runs inference exclusively through llama.cpp (MIT licensed,
// (c) The ggml authors) — see THIRD_PARTY_NOTICES.md.

import { dirname, join, resolve, SEPARATOR } from "@std/path";
import { walk } from "@std/fs";
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

const GPU_TOKENS = ["cuda", "vulkan", "hip", "rocm", "sycl", "kompute", "opencl", "openvino"];

// llama.cpp ships Windows builds as .zip and macOS/Linux builds as .tar.gz.
const ARCHIVE_RE = /\.(zip|tar\.gz|tgz)$/i;

/** Requested backend variant ("cpu" and unset mean the plain CPU/Metal build). */
function requestedBackend(): string | undefined {
  const backend = Deno.env.get("FREELLAMA_BACKEND")?.trim().toLowerCase();
  return backend && backend !== "cpu" ? backend : undefined;
}

/**
 * Pick the best release asset for an OS/arch. Asset names look like
 * "llama-b5900-bin-ubuntu-x64.tar.gz", "llama-b5900-bin-macos-arm64.tar.gz",
 * "llama-b5900-bin-win-cpu-x64.zip", "llama-b5900-bin-ubuntu-vulkan-x64.tar.gz".
 * Without `backend`, prefers the plain CPU/Metal build; with a backend token
 * (e.g. "vulkan", "cuda", "rocm"), only assets carrying that token qualify.
 * Exported for tests.
 */
export function pickAsset(
  assets: ReleaseAsset[],
  os: typeof Deno.build.os,
  arch: typeof Deno.build.arch,
  backend?: string,
): ReleaseAsset | undefined {
  const osToken = os === "darwin" ? "macos" : os === "windows" ? "win" : "ubuntu";
  const archToken = arch === "aarch64" ? "arm64" : "x64";
  const candidates = assets.filter((a) => {
    const n = a.name.toLowerCase();
    return ARCHIVE_RE.test(n) && n.includes("-bin-") && n.includes(osToken) &&
      n.includes(archToken) && (!backend || n.includes(backend));
  });
  const score = (a: ReleaseAsset): number => {
    const n = a.name.toLowerCase();
    let s = 0;
    if (!backend) {
      if (n.includes("cpu")) s += 2;
      for (const gpu of GPU_TOKENS) if (n.includes(gpu)) s -= 5;
    }
    // Tie-breaker: prefer the plainest build (fewest descriptor segments).
    s -= n.split("-").length * 0.1;
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

// Backend builds install into "<tag>-<backend>" so variants of the same tag
// don't collide; the plain CPU/Metal build keeps the bare "<tag>" dir.
function installDirName(tag: string, backend: string | undefined): string {
  return backend ? `${tag}-${backend}` : tag;
}

function dirMatchesBackend(dir: string, backend: string | undefined): boolean {
  if (backend) return dir.endsWith(`-${backend}`);
  return !GPU_TOKENS.some((gpu) => dir.includes(`-${gpu}`));
}

async function findInstalled(backend: string | undefined): Promise<string | undefined> {
  const exe = Deno.build.os === "windows" ? "llama-server.exe" : "llama-server";
  try {
    const tags: string[] = [];
    for await (const entry of Deno.readDir(binDir())) {
      if (entry.isDirectory && dirMatchesBackend(entry.name, backend)) tags.push(entry.name);
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
    for await (const entry of walk(dir, { includeDirs: false })) {
      if (entry.name === name) return entry.path;
    }
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }
  return undefined;
}

/** Exported for tests. */
export async function extractZip(zip: Uint8Array, installDir: string): Promise<void> {
  const entries = unzipSync(zip);
  const root = resolve(installDir);
  for (const [path, data] of Object.entries(entries)) {
    if (path.endsWith("/")) continue;
    const dest = resolve(installDir, path);
    // Zip-slip guard: entry paths come from the archive; never write outside installDir.
    if (dest !== root && !dest.startsWith(root + SEPARATOR)) {
      throw new Error(`Refusing to extract "${path}": escapes ${installDir}`);
    }
    await Deno.mkdir(dirname(dest), { recursive: true });
    await Deno.writeFile(dest, data);
    if (Deno.build.os !== "windows") {
      // fflate does not surface zip permission bits; mark everything executable.
      await Deno.chmod(dest, 0o755);
    }
  }
}

// macOS/Linux release builds are .tar.gz. Unpack via the system `tar`, which
// every macOS and Linux host provides and which preserves the archive's
// executable bits (fflate cannot untar, and the zip path drops permissions).
async function extractTarGz(archive: Uint8Array, installDir: string): Promise<void> {
  const tmp = await Deno.makeTempFile({ suffix: ".tar.gz" });
  try {
    await Deno.writeFile(tmp, archive);
    const { code, stderr } = await new Deno.Command("tar", {
      args: ["-xzf", tmp, "-C", installDir],
      stdout: "null",
      stderr: "piped",
    }).output();
    if (code !== 0) {
      throw new Error(
        `tar failed to extract llama.cpp archive: ${new TextDecoder().decode(stderr)}`,
      );
    }
  } finally {
    await Deno.remove(tmp).catch(() => {});
  }
}

/**
 * Ensure a llama-server binary is available locally, downloading the pinned
 * (or latest) llama.cpp release if needed. Returns the absolute binary path.
 *
 * Set FREELLAMA_LLAMA_VERSION to pin a release tag (e.g. "b5900");
 * FREELLAMA_BACKEND to pick a GPU build variant (e.g. "vulkan", "cuda", "rocm");
 * FREELLAMA_LLAMA_SERVER to point at an existing llama-server binary and skip
 * downloads entirely.
 */
export async function ensureLlamaServer(): Promise<string> {
  const explicit = Deno.env.get("FREELLAMA_LLAMA_SERVER");
  if (explicit) return explicit;

  const version = Deno.env.get("FREELLAMA_LLAMA_VERSION") ?? "latest";
  const backend = requestedBackend();
  const exe = Deno.build.os === "windows" ? "llama-server.exe" : "llama-server";

  // Without an explicit pin, reuse whatever is already installed before going online.
  if (version === "latest") {
    const installed = await findInstalled(backend);
    if (installed) return installed;
  } else {
    const existing = await findFile(join(binDir(), installDirName(version, backend)), exe);
    if (existing) return existing;
  }

  const release = await fetchRelease(version);
  const asset = pickAsset(release.assets, Deno.build.os, Deno.build.arch, backend);
  if (!asset) {
    throw new Error(
      `No prebuilt llama.cpp binary for ${Deno.build.os}/${Deno.build.arch}${
        backend ? ` with backend "${backend}"` : ""
      } in release ${release.tag_name}. ` +
        (backend
          ? `Available assets:\n${release.assets.map((a) => `  - ${a.name}`).join("\n")}\n` +
            `Pick a FREELLAMA_BACKEND matching one of these, or build llama.cpp yourself ` +
            `and set FREELLAMA_LLAMA_SERVER to the llama-server path.`
          : `Build llama.cpp yourself and set FREELLAMA_LLAMA_SERVER to the llama-server path.`),
    );
  }

  const installDir = join(binDir(), installDirName(release.tag_name, backend));
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

  const archive = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    archive.set(chunk, offset);
    offset += chunk.byteLength;
  }

  await Deno.mkdir(installDir, { recursive: true });
  if (/\.(tar\.gz|tgz)$/i.test(asset.name)) {
    await extractTarGz(archive, installDir);
  } else {
    await extractZip(archive, installDir);
  }

  const server = await findFile(installDir, exe);
  if (!server) {
    throw new Error(`llama-server not found inside ${asset.name} after extraction`);
  }
  return server;
}
