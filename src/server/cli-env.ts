import { homedir } from "os";

/**
 * Returns an env object suitable for execSync calls to OpenClaw CLI.
 * Augments PATH with common binary directories so node-based CLIs
 * (like openclaw, which is a .mjs shim) work even when the parent
 * process was started with a minimal environment (e.g. inside Tauri).
 */
export function cliEnv(): NodeJS.ProcessEnv {
  const isWin = process.platform === "win32";
  const sep = isWin ? ";" : ":";
  const home = process.env.HOME ?? homedir();

  const extraDirs = isWin
    ? [
        `${process.env["ProgramFiles"] ?? "C:\\Program Files"}\\nodejs`,
        `${process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)"}\\nodejs`,
        `${home}\\AppData\\Roaming\\npm`,
        `${home}\\AppData\\Local\\fnm\\aliases\\default\\bin`,
        `${home}\\scoop\\shims`,
      ]
    : [
        "/opt/homebrew/bin",      // macOS Apple Silicon (Homebrew)
        "/usr/local/bin",         // macOS Intel / Linux custom
        "/usr/bin",
        "/bin",
        `${home}/.local/bin`,     // Linux pip/pipx installs
        `${home}/.npm-global/bin`,
        `${home}/.volta/bin`,
        `${home}/.fnm/aliases/default/bin`,
      ];

  const current = process.env.PATH ?? "";
  return {
    ...process.env,
    HOME: home,
    PATH: current ? `${current}${sep}${extraDirs.join(sep)}` : extraDirs.join(sep),
  };
}
