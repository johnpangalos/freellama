// Single source of truth for freellama's runtime permissions. The dev, compile,
// and install tasks in deno.json all route through here, so the scoped flag set
// is written in exactly one place instead of copied per task.
//
// env is limited to the vars freellama reads; there is no --allow-ffi/--allow-sys.
// net/run/read/write stay open because model downloads redirect through the
// Hugging Face / GitHub CDNs and the llama-server binary path is resolved at
// runtime (see README).

const PERMS = [
  "--allow-read",
  "--allow-write",
  "--allow-net",
  "--allow-run",
  "--allow-env=FREELLAMA_CTX,FREELLAMA_DEBUG,FREELLAMA_HOME,FREELLAMA_LLAMA_SERVER," +
  "FREELLAMA_LLAMA_VERSION,FREELLAMA_SERVER_ARGS,GITHUB_TOKEN,HF_TOKEN,HOME,USERPROFILE",
];

const [task, ...rest] = Deno.args;
const tasks: Record<string, string[]> = {
  // dev forwards trailing args, e.g. `deno task dev run <model>`.
  dev: ["run", ...PERMS, "src/cli.ts", ...rest],
  compile: ["compile", ...PERMS, "--output", "freellama", "src/cli.ts"],
  install: ["install", "--global", "--force", "--name", "freellama", ...PERMS, "src/cli.ts"],
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
