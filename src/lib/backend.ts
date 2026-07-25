// llama.cpp backend manager: downloads the official prebuilt llama-server binary
// from ggml-org/llama.cpp GitHub releases into ~/.freellama/bin/<tag>/.
//
// freellama runs inference exclusively through llama.cpp (MIT licensed,
// (c) The ggml authors) — see THIRD_PARTY_NOTICES.md.

import { dirname, isAbsolute, join, normalize, resolve, SEPARATOR } from "@std/path";
import { walk } from "@std/fs";
import { UntarStream } from "@std/tar/untar-stream";
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

/**
 * Pick the best CPU/Metal release asset for an OS/arch. Asset names look like
 * "llama-b5900-bin-ubuntu-x64.tar.gz", "llama-b5900-bin-macos-arm64.tar.gz",
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
    return ARCHIVE_RE.test(n) && n.includes("-bin-") && n.includes(osToken) &&
      n.includes(archToken);
  });
  const score = (a: ReleaseAsset): number => {
    const n = a.name.toLowerCase();
    let s = 0;
    if (n.includes("cpu")) s += 2;
    for (const gpu of GPU_TOKENS) if (n.includes(gpu)) s -= 5;
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

/** The newest llama-server already unpacked under ~/.freellama/bin, if any. */
async function findInstalled(): Promise<{ path: string; tag: string } | undefined> {
  const exe = serverExe();
  try {
    const tags: string[] = [];
    for await (const entry of Deno.readDir(binDir())) {
      if (entry.isDirectory) tags.push(entry.name);
    }
    // Rolling llama.cpp tags ("b5900") sort correctly by numeric part.
    tags.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const tag of tags) {
      const found = await findFile(join(binDir(), tag), exe);
      if (found) return { path: found, tag };
    }
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }
  return undefined;
}

function serverExe(): string {
  return Deno.build.os === "windows" ? "llama-server.exe" : "llama-server";
}

/** Release tag of the currently installed backend, for `freellama upgrade` to report. */
export async function installedBackendTag(): Promise<string | undefined> {
  return (await findInstalled())?.tag;
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

/**
 * macOS/Linux release builds are .tar.gz. Unpacked in-process with the
 * web-standard gzip DecompressionStream and @std/tar, so freellama needs no
 * `tar` on PATH and both extraction paths behave the same. Unlike the zip path
 * (fflate does not surface permission bits) the tar headers carry the mode, so
 * executables keep exactly the bits the archive declared. Exported for tests.
 */
export async function extractTarGz(
  archive: Uint8Array<ArrayBuffer>,
  installDir: string,
): Promise<void> {
  const root = resolve(installDir);
  // Entry paths come from the archive; never write outside installDir. Applies
  // to link targets too, so an archive cannot point a symlink at /etc.
  const safeDest = (path: string): string => {
    const dest = resolve(installDir, normalize(path));
    if (dest !== root && !dest.startsWith(root + SEPARATOR)) {
      throw new Error(`Refusing to extract "${path}": escapes ${installDir}`);
    }
    return dest;
  };

  const entries = ReadableStream.from([archive])
    .pipeThrough(new DecompressionStream("gzip"))
    .pipeThrough(new UntarStream());
  // A name longer than the 100-byte ustar header field arrives as an extension
  // record that renames the entry after it. UntarStream passes these through
  // verbatim, so without applying them here a deeply nested path would be
  // silently truncated to its first 100 bytes.
  let longPath: string | undefined;
  let longLink: string | undefined;
  for await (const entry of entries) {
    const type = entry.header.typeflag;
    if (EXTENSION_TYPES.has(type)) {
      const body = entry.readable ? await readAll(entry.readable) : new Uint8Array();
      if (type === "L") longPath = decodeCString(body);
      else if (type === "K") longLink = decodeCString(body);
      else if (type === "x") {
        // "g" is a global default rather than an override of the next entry;
        // nothing in a llama.cpp release needs it.
        const records = paxRecords(body);
        longPath = records.path ?? longPath;
        longLink = records.linkpath ?? longLink;
      }
      continue;
    }
    const path = longPath ?? entry.path;
    const linkname = longLink ?? entry.header.linkname;
    longPath = longLink = undefined;

    const dest = safeDest(path);
    if (type === "5") {
      await Deno.mkdir(dest, { recursive: true });
      continue;
    }
    if (type === "1" || type === "2") {
      // Shared libraries in the release tarballs ship as symlinks next to their
      // versioned target; dropping them would leave llama-server unable to link.
      // A symlink's target is relative to its own directory, a hard link's to
      // the archive root — either way it has to land inside installDir.
      //
      // Absolute targets are rejected outright rather than range-checked: join()
      // treats an absolute segment as relative ("pkg" + "/etc/passwd" is
      // "pkg/etc/passwd"), so folding one into the guard would hide it, and a
      // later entry writing through the link would land on the real /etc/passwd.
      if (isAbsolute(linkname)) {
        throw new Error(`Refusing to extract "${path}": absolute link target "${linkname}"`);
      }
      const target = safeDest(type === "2" ? join(dirname(path), linkname) : linkname);
      await Deno.mkdir(dirname(dest), { recursive: true });
      await Deno.remove(dest).catch(() => {});
      if (type === "2") await Deno.symlink(linkname, dest);
      else await Deno.link(target, dest);
      continue;
    }
    // Anything else (character/block devices, FIFOs) has no place in a
    // llama.cpp release; drain it so the stream can advance.
    if (type !== "0" && type !== "\0") {
      await entry.readable?.cancel();
      continue;
    }
    await Deno.mkdir(dirname(dest), { recursive: true });
    // Unlink first: Deno.create follows an existing symlink, so an archive that
    // ships a link and then a file at the same path would write through it.
    await Deno.remove(dest).catch(() => {});
    const file = await Deno.create(dest);
    if (entry.readable) await entry.readable.pipeTo(file.writable);
    else file.close();
    if (Deno.build.os !== "windows" && entry.header.mode) {
      await Deno.chmod(dest, entry.header.mode & 0o777);
    }
  }
}

/** GNU long-name/long-link records and pax extended headers. */
const EXTENSION_TYPES = new Set(["L", "K", "x", "g"]);

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Decode a NUL-terminated string, as GNU writes long names. */
function decodeCString(bytes: Uint8Array): string {
  const end = bytes.indexOf(0);
  return new TextDecoder().decode(end === -1 ? bytes : bytes.subarray(0, end));
}

/**
 * Parse a pax extended header body: a run of "<len> <key>=<value>\n" records
 * where len counts the record's own bytes. Parsed over bytes rather than a
 * decoded string because len is a byte count.
 */
function paxRecords(body: Uint8Array): Record<string, string> {
  const decoder = new TextDecoder();
  const records: Record<string, string> = {};
  let offset = 0;
  while (offset < body.length) {
    const space = body.indexOf(0x20, offset);
    if (space === -1) break;
    const length = Number(decoder.decode(body.subarray(offset, space)));
    if (!Number.isInteger(length) || length <= 0 || offset + length > body.length) break;
    // Drop the record's trailing newline.
    const record = decoder.decode(body.subarray(space + 1, offset + length - 1));
    offset += length;
    const equals = record.indexOf("=");
    if (equals > 0) records[record.slice(0, equals)] = record.slice(equals + 1);
  }
  return records;
}

/**
 * Ensure a llama-server binary is available locally, downloading the pinned
 * (or latest) llama.cpp release if needed. Returns the absolute binary path.
 *
 * "latest" means the newest release as of the first install: an already
 * installed backend is reused rather than re-resolved, so no command silently
 * pulls a fresh llama.cpp build out from under you. `freellama upgrade` is how
 * you move to a newer one.
 *
 * Set FREELLAMA_LLAMA_VERSION to pin a release tag (e.g. "b5900");
 * FREELLAMA_LLAMA_SERVER to point at an existing llama-server binary and skip
 * downloads entirely.
 */
export async function ensureLlamaServer(): Promise<string> {
  const explicit = Deno.env.get("FREELLAMA_LLAMA_SERVER");
  if (explicit) return explicit;

  const version = Deno.env.get("FREELLAMA_LLAMA_VERSION") ?? "latest";

  if (version === "latest") {
    const installed = await findInstalled();
    if (installed) return installed.path;
  } else {
    const existing = await findFile(join(binDir(), version), serverExe());
    if (existing) return existing;
  }
  return await installRelease(await fetchRelease(version));
}

/**
 * Install the newest llama.cpp release (or the pinned tag), replacing "reuse
 * whatever is on disk" with an explicit, user-driven update. Returns the tag
 * and whether it was already the installed one.
 */
export async function upgradeLlamaServer(): Promise<{ tag: string; alreadyInstalled: boolean }> {
  if (Deno.env.get("FREELLAMA_LLAMA_SERVER")) {
    throw new Error(
      "FREELLAMA_LLAMA_SERVER points freellama at your own llama-server build, which it does not manage. Unset it to upgrade the downloaded backend.",
    );
  }
  const release = await fetchRelease(Deno.env.get("FREELLAMA_LLAMA_VERSION") ?? "latest");
  const existing = await findFile(join(binDir(), release.tag_name), serverExe());
  if (existing) return { tag: release.tag_name, alreadyInstalled: true };
  await installRelease(release);
  return { tag: release.tag_name, alreadyInstalled: false };
}

/** Download and unpack a release into ~/.freellama/bin/<tag>. Returns the binary path. */
async function installRelease(release: Release): Promise<string> {
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

  const server = await findFile(installDir, serverExe());
  if (!server) {
    throw new Error(`llama-server not found inside ${asset.name} after extraction`);
  }
  return server;
}
