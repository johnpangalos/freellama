// Task runner for dev/compile/install. The runtime permission flags are parsed
// out of the src/cli.ts shebang — the single source of truth — so direct
// `./src/cli.ts` execution and every task here run with the identical scoped
// flag set, and the compiled/installed binary behaves like development.
//
// env is limited to the vars freellama reads; there is no --allow-ffi/--allow-sys.
// net/run/read/write stay open because model downloads redirect through the
// Hugging Face / GitHub CDNs and the llama-server binary path is resolved at
// runtime (see README).

const CLI = "src/cli.ts";
const shebang = (await Deno.readTextFile(CLI)).split("\n", 1)[0];
const PERMS = shebang.split(" ").filter((flag) => flag.startsWith("--"));
if (!shebang.startsWith("#!") || PERMS.length === 0) {
  console.error(`no permission flags found in the ${CLI} shebang`);
  Deno.exit(2);
}

const [task, ...rest] = Deno.args;
const tasks: Record<string, string[]> = {
  // dev forwards trailing args, e.g. `deno task dev run <model>`.
  dev: ["run", ...PERMS, CLI, ...rest],
  compile: ["compile", ...PERMS, "--output", "freellama", CLI],
  install: ["install", "--global", "--force", "--name", "freellama", ...PERMS, CLI],
};

const args = tasks[task];
if (!args) {
  console.error(`unknown task "${task}" — expected one of: ${Object.keys(tasks).join(", ")}`);
  Deno.exit(2);
}

const { code } = await new Deno.Command("deno", {
  args,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
}).output();
Deno.exit(code);
