import { gameSaveCommands } from "../../features/persistence";

let initialized = false;

/**
 * Browser application composition root. Feature services start here rather
 * than in a specific page component, so navigation cannot silently disable
 * persistence or authentication initialization.
 */
export function initializeApplication(): void {
  if (initialized) return;
  initialized = true;
  gameSaveCommands.initialize();
}
