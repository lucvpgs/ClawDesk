import { homedir } from "os";

/**
 * Returns an env object suitable for execSync calls to OpenClaw CLI.
 * Augments PATH with common binary directories so node-based CLIs
 * (like openclaw, which is a .mjs shim) work even when the parent
 * process was started with a minimal environment (e.g. inside Tauri).
 */
export function cliEnv(): NodeJS.ProcessEnv {
  const extra = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
  const current = process.env.PATH ?? "";
  return {
    ...process.env,
    HOME: process.env.HOME ?? homedir(),
    PATH: current ? `${current}:${extra}` : extra,
  };
}
