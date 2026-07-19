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

/** Split a text stream into lines (drops trailing \r, emits remainder on close). */
export class LineStream extends TransformStream<string, string> {
  constructor() {
    let buffer = "";
    super({
      transform(chunk, controller) {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          controller.enqueue(line.endsWith("\r") ? line.slice(0, -1) : line);
        }
      },
      flush(controller) {
        if (buffer.length > 0) controller.enqueue(buffer);
      },
    });
  }
}
