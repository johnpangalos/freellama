import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { join } from "@std/path";
import { decodeBase64 } from "@std/encoding/base64";
import { zipSync } from "fflate";
import {
  type HfTreeEntry,
  matchQuant,
  nextPageUrl,
  parseHfRef,
  refToName,
  splitParts,
} from "../src/lib/hf.ts";
import { extractTarGz, extractZip, pickAsset } from "../src/lib/backend.ts";
import { TarStream, type TarStreamInput } from "@std/tar";
import { DEFAULT_CTX, resolveContextSize } from "../src/lib/runner.ts";
import { formatBytes, tokenizeArgs } from "../src/lib/util.ts";

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

function entry(path: string, size = 1): HfTreeEntry {
  return { type: "file", path, size };
}

Deno.test("splitParts: single-file gguf resolves to itself", () => {
  const single = entry("model-Q4_K_M.gguf");
  assertEquals(splitParts(single, [single, entry("other-Q8_0.gguf")]), [single]);
});

Deno.test("splitParts: expands the full group in order from any part", () => {
  const parts = [
    entry("UD-IQ1_S/m-UD-IQ1_S-00002-of-00003.gguf"),
    entry("UD-IQ1_S/m-UD-IQ1_S-00001-of-00003.gguf"),
    entry("UD-IQ1_S/m-UD-IQ1_S-00003-of-00003.gguf"),
  ];
  const all = [...parts, entry("Q8_0/m-Q8_0-00001-of-00002.gguf")];
  assertEquals(splitParts(parts[0], all).map((f) => f.path), [
    "UD-IQ1_S/m-UD-IQ1_S-00001-of-00003.gguf",
    "UD-IQ1_S/m-UD-IQ1_S-00002-of-00003.gguf",
    "UD-IQ1_S/m-UD-IQ1_S-00003-of-00003.gguf",
  ]);
});

Deno.test("splitParts: rejects a group with missing parts", () => {
  const first = entry("m-Q4-00001-of-00003.gguf");
  assertThrows(
    () => splitParts(first, [first, entry("m-Q4-00003-of-00003.gguf")]),
    Error,
    "m-Q4-00002-of-00003.gguf",
  );
});

Deno.test("matchQuant: exact suffix match wins over loose substring hits", () => {
  const ggufs = [entry("m-Q4_K_M.gguf"), entry("m-Q4_K_M-imat.gguf")];
  assertEquals(matchQuant(parseHfRef("u/r:Q4_K_M"), ggufs).path, "m-Q4_K_M.gguf");
});

Deno.test("matchQuant: parts of one split gguf are a single candidate", () => {
  const ggufs = [
    entry("Q4_K_M/m-Q4_K_M-00001-of-00002.gguf"),
    entry("Q4_K_M/m-Q4_K_M-00002-of-00002.gguf"),
  ];
  assertEquals(matchQuant(parseHfRef("u/r:Q4_K_M"), ggufs).path, ggufs[0].path);
});

Deno.test("matchQuant: a vision repo's mmproj companion is not a rival model", () => {
  // Real shape of unsloth/gemma-3-4b-it-GGUF and ggml-org/gemma-3-4b-it-GGUF:
  // the projector carries the same precision label as the weights.
  const ggufs = [entry("gemma-3-4b-it-BF16.gguf"), entry("mmproj-BF16.gguf")];
  assertEquals(matchQuant(parseHfRef("u/r:BF16"), ggufs).path, "gemma-3-4b-it-BF16.gguf");
  assertEquals(
    matchQuant(parseHfRef("u/r:F16"), [
      entry("gemma-3-4b-it-f16.gguf"),
      entry("mmproj-model-f16.gguf"),
    ]).path,
    "gemma-3-4b-it-f16.gguf",
  );
});

Deno.test("matchQuant: rejects an ambiguous quant instead of guessing", () => {
  const ggufs = [entry("m-Q4_0.gguf"), entry("m-Q4_1.gguf"), entry("m-Q4_K_M.gguf")];
  assertThrows(() => matchQuant(parseHfRef("u/r:Q4"), ggufs), Error, "ambiguous");
});

Deno.test("matchQuant: reports the candidates it could not choose between", () => {
  const ggufs = [entry("m-Q4_0.gguf"), entry("m-Q4_1.gguf")];
  assertThrows(() => matchQuant(parseHfRef("u/r:Q4"), ggufs), Error, "m-Q4_1.gguf");
});

Deno.test("matchQuant: no match lists what the repo does have", () => {
  assertThrows(
    () => matchQuant(parseHfRef("u/r:Q9"), [entry("m-Q4_0.gguf")]),
    Error,
    "m-Q4_0.gguf",
  );
});

Deno.test("nextPageUrl: reads rel=next out of a Link header", () => {
  assertEquals(
    nextPageUrl(
      '<https://huggingface.co/api/models/u/r/tree/main?cursor=eyJhIjoxfQ%3D%3D>; rel="next"',
    ),
    "https://huggingface.co/api/models/u/r/tree/main?cursor=eyJhIjoxfQ%3D%3D",
  );
  assertEquals(nextPageUrl('<https://example.com/prev>; rel="prev"'), undefined);
  assertEquals(nextPageUrl(null), undefined);
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

async function makeTarGz(inputs: TarStreamInput[]): Promise<Uint8Array<ArrayBuffer>> {
  const chunks = await Array.fromAsync(
    ReadableStream.from(inputs)
      .pipeThrough(new TarStream())
      .pipeThrough(new CompressionStream("gzip")),
  );
  return new Uint8Array(await new Blob(chunks).arrayBuffer());
}

function tarFile(path: string, contents: string, mode?: number): TarStreamInput {
  const data = new TextEncoder().encode(contents);
  return {
    type: "file",
    path,
    size: data.byteLength,
    readable: ReadableStream.from([data]),
    ...(mode === undefined ? {} : { options: { mode } }),
  };
}

Deno.test("extractTarGz writes entries and keeps their mode bits", async () => {
  const dir = await Deno.makeTempDir({ prefix: "freellama-tar-" });
  try {
    await extractTarGz(
      await makeTarGz([
        { type: "directory", path: "build/bin/" },
        tarFile("build/bin/llama-server", "fake", 0o755),
        tarFile("build/bin/notes.txt", "hi", 0o644),
      ]),
      dir,
    );
    const server = join(dir, "build", "bin", "llama-server");
    assertEquals(await Deno.readTextFile(server), "fake");
    if (Deno.build.os !== "windows") {
      assertEquals((await Deno.stat(server)).mode! & 0o777, 0o755);
      assertEquals((await Deno.stat(join(dir, "build", "bin", "notes.txt"))).mode! & 0o777, 0o644);
    }
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("extractTarGz recreates symlinks inside the install dir", async () => {
  const dir = await Deno.makeTempDir({ prefix: "freellama-tar-" });
  try {
    await extractTarGz(
      await makeTarGz([
        tarFile("lib/libggml.so.0", "shared object"),
        { type: "symlink", path: "lib/libggml.so", linkname: "libggml.so.0" },
      ]),
      dir,
    );
    assertEquals(await Deno.readTextFile(join(dir, "lib", "libggml.so")), "shared object");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

// A real GNU-format archive (`tar --format=gnu -czf`), the format the llama.cpp
// Linux release builds ship in. It holds an executable, a symlink, and a path
// too long for the 100-byte ustar name field — which GNU tar encodes as a
// separate "L" record that renames the entry after it. @std/tar surfaces those
// records verbatim rather than applying them, so this is what stops a nested
// path from being silently truncated back to 100 bytes.
const GNU_TAR_GZ_BASE64 =
  "H4sIAAAAAAAAA+2X4W6DIBDHeRRf4FBU9OseoC9BJ1UyhQVxWd9+bE2Ttd3auAxc5/2+YALC5f7c" +
  "35OmJDiZp+b8Y/Scj1881xXPScLDh0bINDphk4RYY9y1dbfm7xSa0vRhY3S7Ufop0BnvolZl+a3+" +
  "jLNT/Rmr/JBsAsVzwur1F9AoKx+dsXvQYpDQ+9sAUpup7cB1wkGrJ/BJgsHnCuSgHAg4Xhnwrxrb" +
  "gNKjk6IBs4NpVH4D18nDdjsl+yaCyyA/IYb+s/2/yDO/HP0/An/C/6vi0v8L9P8YxPJ/Lf18Q93r" +
  "f0ziHRPL/6/Vf5aVl/7PSJLFSMDK67+R8nnpGJDloOl2UoH789n9H/PLGfZ/MTjqv1U62B2Yrz/j" +
  "Oeofhc/6970YBIzSvkj7m2fc1r8607/MCo7f/xh43YXdLx0FshQ0PdQ79GH//+u6nuH/Vc5qkuTh" +
  "rWn19Y8gCIIgCIIgCIKsgzcAp9taACgAAA==";

Deno.test("extractTarGz applies GNU long-name records instead of truncating", async () => {
  const dir = await Deno.makeTempDir({ prefix: "freellama-tar-" });
  const longName =
    "a-directory-name-long-enough-that-gnu-tar-must-emit-a-LongLink-record-instead-of-using-the-name-field";
  try {
    await extractTarGz(decodeBase64(GNU_TAR_GZ_BASE64), dir);
    assertEquals(await Deno.readTextFile(join(dir, longName, "nested.txt")), "deep");
    assertEquals(await Deno.readTextFile(join(dir, "server-link")), "binary");
    if (Deno.build.os !== "windows") {
      const mode = (await Deno.stat(join(dir, "build", "bin", "llama-server"))).mode! & 0o777;
      assertEquals(mode, 0o755);
    }
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("extractTarGz rejects entries that escape the install dir", async () => {
  const dir = await Deno.makeTempDir({ prefix: "freellama-tar-" });
  try {
    const evil = await makeTarGz([tarFile("build/../../evil.txt", "boom")]);
    await assertRejects(() => extractTarGz(evil, dir), Error, "escapes");
    await assertRejects(
      () => Deno.stat(join(dir, "..", "..", "evil.txt")),
      Deno.errors.NotFound,
      undefined,
      "tar-slip file was written outside the install dir",
    );
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("extractTarGz rejects an absolute symlink target", async () => {
  const dir = await Deno.makeTempDir({ prefix: "freellama-tar-" });
  const outside = await Deno.makeTempDir({ prefix: "freellama-outside-" });
  const victim = join(outside, "victim.txt");
  await Deno.writeTextFile(victim, "original");
  try {
    // join() folds an absolute segment into the install dir, so an absolute
    // target would pass a range check and then be written through by the file
    // entry that follows it.
    const evil = await makeTarGz([
      { type: "symlink", path: "pkg/link", linkname: victim },
      tarFile("pkg/link", "overwritten"),
    ]);
    await assertRejects(() => extractTarGz(evil, dir), Error, "absolute link target");
    assertEquals(await Deno.readTextFile(victim), "original");
  } finally {
    await Deno.remove(dir, { recursive: true });
    await Deno.remove(outside, { recursive: true });
  }
});

Deno.test("extractTarGz does not write through a symlink left by an earlier entry", async () => {
  const dir = await Deno.makeTempDir({ prefix: "freellama-tar-" });
  try {
    // Both entries stay inside the install dir, so nothing escapes — but the
    // file must replace the link rather than follow it to lib/real.txt.
    await extractTarGz(
      await makeTarGz([
        tarFile("lib/real.txt", "original"),
        { type: "symlink", path: "pkg/link", linkname: "../lib/real.txt" },
        tarFile("pkg/link", "replacement"),
      ]),
      dir,
    );
    assertEquals(await Deno.readTextFile(join(dir, "lib", "real.txt")), "original");
    assertEquals(await Deno.readTextFile(join(dir, "pkg", "link")), "replacement");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("extractTarGz rejects a symlink pointing outside the install dir", async () => {
  const dir = await Deno.makeTempDir({ prefix: "freellama-tar-" });
  try {
    const evil = await makeTarGz([
      { type: "symlink", path: "lib/escape", linkname: "../../../../etc/passwd" },
    ]);
    await assertRejects(() => extractTarGz(evil, dir), Error, "escapes");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("tokenizeArgs: plain flags split on whitespace", () => {
  assertEquals(tokenizeArgs("--flash-attn  -ngl 99\t--mlock"), [
    "--flash-attn",
    "-ngl",
    "99",
    "--mlock",
  ]);
  assertEquals(tokenizeArgs(""), []);
  assertEquals(tokenizeArgs("   "), []);
});

Deno.test("tokenizeArgs: quotes group values containing spaces", () => {
  assertEquals(tokenizeArgs('--chat-template "my template"'), ["--chat-template", "my template"]);
  assertEquals(tokenizeArgs("--alias 'a b'"), ["--alias", "a b"]);
  // Quotes may also wrap only part of an argument.
  assertEquals(tokenizeArgs('--alias="a b"'), ["--alias=a b"]);
  assertEquals(tokenizeArgs('--alias ""'), ["--alias", ""]);
});

Deno.test("tokenizeArgs: backslash escapes outside single quotes", () => {
  assertEquals(tokenizeArgs("--alias a\\ b"), ["--alias", "a b"]);
  assertEquals(tokenizeArgs("--alias 'a\\ b'"), ["--alias", "a\\ b"]);
});

Deno.test("tokenizeArgs: double quotes keep backslashes that are not escapes", () => {
  // As in a POSIX shell, only " \ $ ` are escapable inside double quotes — so a
  // Windows path keeps its separators instead of losing them to \t and \m.
  assertEquals(tokenizeArgs('--tmpl "C:\\tmp\\t.jinja"'), ["--tmpl", "C:\\tmp\\t.jinja"]);
  assertEquals(tokenizeArgs('--alias "say \\"hi\\""'), ["--alias", 'say "hi"']);
  assertEquals(tokenizeArgs('--alias "a\\\\b"'), ["--alias", "a\\b"]);
});

Deno.test("tokenizeArgs: rejects an unterminated quote", () => {
  assertThrows(() => tokenizeArgs('--chat-template "oops'), Error, "Unterminated");
});

Deno.test("resolveContextSize: explicit flag, then env, then the default", () => {
  const prev = Deno.env.get("FREELLAMA_CTX");
  try {
    Deno.env.delete("FREELLAMA_CTX");
    assertEquals(resolveContextSize(), DEFAULT_CTX);
    assertEquals(resolveContextSize("8192"), 8192);
    // 0 defers to the model's trained context rather than meaning "unset".
    assertEquals(resolveContextSize("0"), 0);
    Deno.env.set("FREELLAMA_CTX", "16384");
    assertEquals(resolveContextSize(), 16384);
    assertEquals(resolveContextSize("4096"), 4096);
  } finally {
    if (prev === undefined) Deno.env.delete("FREELLAMA_CTX");
    else Deno.env.set("FREELLAMA_CTX", prev);
  }
});

Deno.test("resolveContextSize: rejects a value that is not a whole count", () => {
  assertThrows(() => resolveContextSize("-1"), Error, "Invalid context size");
  assertThrows(() => resolveContextSize("many"), Error, "Invalid context size");
  assertThrows(() => resolveContextSize("4096.5"), Error, "Invalid context size");
});

Deno.test("formatBytes", () => {
  assertEquals(formatBytes(500), "500 B");
  assertEquals(formatBytes(398_000_000), "398 MB");
});
