import { dim } from "@std/fmt/colors";

/**
 * Print a status/progress line. Status goes to stderr (dimmed on color terminals)
 * so stdout stays clean data — `freellama run` in a pipeline emits only the reply.
 */
export function status(msg: string): void {
  console.error(dim(msg));
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
