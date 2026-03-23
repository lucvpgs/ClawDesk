/**
 * cliRun — wrapper over spawnSync for openclaw CLI calls.
 *
 * The openclaw CLI writes output to stderr (not stdout) for most sub-commands.
 * execSync only captures stdout, causing silent empty-string failures.
 * This helper captures both and returns whichever has content.
 */
import { spawnSync } from "child_process";
import { cliEnv } from "./cli-env";
import { findOpenClawBinary } from "./connector/openclaw-scan";

export function cliRun(
  args: string[],
  options: { timeout?: number; bin?: string } = {}
): string {
  const bin = options.bin ?? findOpenClawBinary() ?? "openclaw";
  const result = spawnSync(bin, args, {
    timeout: options.timeout ?? 10_000,
    encoding: "utf-8",
    env: cliEnv(),
  });

  if (result.error) throw result.error;

  // openclaw writes JSON to stderr for most commands — try stdout first, fall back to stderr
  const out = result.stdout?.trim() || result.stderr?.trim() || "";
  if (!out) {
    throw new Error(`openclaw ${args.join(" ")} exited with code ${result.status} and no output`);
  }
  return out;
}
