import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { join } from "@std/path";
import { zipSync } from "fflate";
import { parseHfRef, refToName } from "../src/lib/hf.ts";
import { extractZip, pickAsset } from "../src/lib/backend.ts";
import { formatBytes } from "../src/lib/util.ts";

Deno.test("parseHfRef: repo with quant", () => {
  assertEquals(parseHfRef("hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M"), {
    repo: "Qwen/Qwen2.5-0.5B-Instruct-GGUF",
    file: undefined,
    quant: "Q4_K_M",
  });
});

Deno.test("parseHfRef: works without hf: prefix", () => {
  assertEquals(parseHfRef("Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M").quant, "Q4_K_M");
});

Deno.test("parseHfRef: explicit file path", () => {
  const ref = parseHfRef("hf:user/repo/subdir/model-q4.gguf");
  assertEquals(ref.repo, "user/repo");
  assertEquals(ref.file, "subdir/model-q4.gguf");
});

Deno.test("parseHfRef: bare repo has no quant or file", () => {
  assertEquals(parseHfRef("user/repo"), { repo: "user/repo", file: undefined, quant: undefined });
});

Deno.test("parseHfRef: rejects garbage", () => {
  assertThrows(() => parseHfRef("not a model"));
  assertThrows(() => parseHfRef("hf:singlesegment"));
});

Deno.test("refToName round-trips", () => {
  assertEquals(refToName(parseHfRef("hf:a/b:Q8_0")), "a/b:Q8_0");
  assertEquals(refToName(parseHfRef("a/b/f.gguf")), "a/b/f.gguf");
});

// Current llama.cpp releases ship macOS/Linux builds as .tar.gz and Windows as .zip.
const assets = [
  "llama-b10068-bin-macos-arm64.tar.gz",
  "llama-b10068-bin-macos-x64.tar.gz",
  "llama-b10068-bin-ubuntu-arm64.tar.gz",
  "llama-b10068-bin-ubuntu-x64.tar.gz",
  "llama-b10068-bin-ubuntu-vulkan-x64.tar.gz",
  "llama-b10068-bin-ubuntu-openvino-2026.2.1-x64.tar.gz",
  "llama-b10068-bin-ubuntu-rocm-7.2-x64.tar.gz",
  "llama-b10068-bin-win-cpu-x64.zip",
  "llama-b10068-bin-win-cuda-12.4-x64.zip",
  "llama-b10068-xcframework.zip",
].map((name) => ({ name, browser_download_url: `https://example.com/${name}`, size: 1 }));

Deno.test("pickAsset: linux x64 prefers plain ubuntu build over accelerators", () => {
  assertEquals(pickAsset(assets, "linux", "x86_64")?.name, "llama-b10068-bin-ubuntu-x64.tar.gz");
});

Deno.test("pickAsset: macos arm64", () => {
  assertEquals(pickAsset(assets, "darwin", "aarch64")?.name, "llama-b10068-bin-macos-arm64.tar.gz");
});

Deno.test("pickAsset: windows prefers cpu build over cuda", () => {
  assertEquals(pickAsset(assets, "windows", "x86_64")?.name, "llama-b10068-bin-win-cpu-x64.zip");
});

Deno.test("pickAsset: legacy .zip macOS assets still match", () => {
  const legacy = [{
    name: "llama-b5900-bin-macos-arm64.zip",
    browser_download_url: "https://example.com/x.zip",
    size: 1,
  }];
  assertEquals(pickAsset(legacy, "darwin", "aarch64")?.name, "llama-b5900-bin-macos-arm64.zip");
});

Deno.test("extractZip writes entries into the install dir", async () => {
  const dir = await Deno.makeTempDir({ prefix: "freellama-zip-" });
  try {
    const zip = zipSync({ "build/bin/llama-server": new TextEncoder().encode("fake") });
    await extractZip(zip, dir);
    const written = await Deno.readTextFile(join(dir, "build", "bin", "llama-server"));
    assertEquals(written, "fake");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("extractZip rejects entries that escape the install dir (zip-slip)", async () => {
  const dir = await Deno.makeTempDir({ prefix: "freellama-zip-" });
  try {
    const evil = zipSync({ "../evil.txt": new TextEncoder().encode("boom") });
    await assertRejects(() => extractZip(evil, dir), Error, "escapes");
    await assertRejects(
      () => Deno.stat(join(dir, "..", "evil.txt")),
      Deno.errors.NotFound,
      undefined,
      "zip-slip file was written outside the install dir",
    );
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("formatBytes", () => {
  assertEquals(formatBytes(500), "500 B");
  assertEquals(formatBytes(398_000_000), "398 MB");
});

Deno.test("deno.compile.jsonc imports stay in sync with deno.json", async () => {
  const root = JSON.parse(await Deno.readTextFile(new URL("../deno.json", import.meta.url)));
  const compileRaw = await Deno.readTextFile(new URL("../deno.compile.jsonc", import.meta.url));
  // deno.compile.jsonc only uses full-line // comments, so stripping those
  // lines yields plain JSON.
  const compile = JSON.parse(
    compileRaw.split("\n").filter((line) => !line.trimStart().startsWith("//")).join("\n"),
  );
  assertEquals(compile.imports, root.imports);
});
