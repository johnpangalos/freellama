import { status } from "../lib/util.ts";
import { installedBackendTag, upgradeLlamaServer } from "../lib/backend.ts";

export async function upgradeCommand(_args: string[]): Promise<void> {
  const previous = await installedBackendTag();
  status(previous ? `installed llama.cpp backend: ${previous}` : "no llama.cpp backend installed");

  const { tag, alreadyInstalled } = await upgradeLlamaServer();
  if (alreadyInstalled) {
    console.log(`llama.cpp ${tag} is already installed`);
    return;
  }
  console.log(previous ? `upgraded llama.cpp ${previous} -> ${tag}` : `installed llama.cpp ${tag}`);
  if (previous) {
    // Left in place deliberately: the old build stays usable if the new one
    // misbehaves, and removing multi-hundred-megabyte trees is the user's call.
    status(
      `the previous build is still in ~/.freellama/bin/${previous}; remove it to reclaim disk`,
    );
  }
}
