import { dim } from "@std/fmt/colors";

/**
 * Print a status/progress line. Status goes to stderr (dimmed on color terminals)
 * so stdout stays clean data — `freellama run` in a pipeline emits only the reply.
 */
export function status(msg: string): void {
  console.error(dim(msg));
}

/**
 * Split a command-line string into arguments the way a POSIX shell would:
 * whitespace separates, single and double quotes group, and a backslash escapes
 * the next character outside single quotes. No expansion of any kind — this is
 * only about quoting, so a flag value containing a space can be expressed
 * (FREELLAMA_SERVER_ARGS='--chat-template "my template"').
 */
export function tokenizeArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let quote: '"' | "'" | undefined;
  // Tracked separately from current.length so that `--flag ""` yields an empty
  // argument rather than being dropped.
  let started = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === "\\" && quote !== "'" && i + 1 < input.length) {
      current += input[++i];
      started = true;
    } else if (quote) {
      if (char === quote) quote = undefined;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started) args.push(current);
      current = "";
      started = false;
    } else {
      current += char;
      started = true;
    }
  }
  if (quote) throw new Error(`Unterminated ${quote} quote in: ${input}`);
  if (started) args.push(current);
  return args;
}

/** Human-readable byte size, e.g. 398 MB. */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return `${n} B`;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  return `${unit === 0 ? value : value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}
