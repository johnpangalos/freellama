import { removeModel } from "../lib/store.ts";

export async function rmCommand(args: string[]): Promise<void> {
  const name = args[0];
  if (!name) throw new Error("Usage: freellama rm <model>");
  const removed = await removeModel(name);
  if (!removed) throw new Error(`Model "${name}" not found. See: freellama list`);
  console.log(`removed ${name}`);
}
