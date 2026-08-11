import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const BUN_NAME = "bun.exe";

function getInstalledBunPath(): string | null {
  const appDirectory = dirname(process.execPath);

  const localBun = join(appDirectory, "runtime", BUN_NAME);

  if (existsSync(localBun)) {
    return localBun;
  }

  const userBun = join(process.env.USERPROFILE ?? "", ".bun", "bin", BUN_NAME);

  if (existsSync(userBun)) {
    return userBun;
  }

  return null;
}

async function installBun(): Promise<string> {
  console.log("[JA-TUI] Bun runtime not found.");
  console.log("[JA-TUI] Installing Bun...");

  return new Promise((resolve, reject) => {
    const powershell = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "irm bun.sh/install.ps1 | iex",
      ],
      {
        windowsHide: false,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";

    powershell.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    powershell.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    powershell.on("error", reject);

    powershell.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Bun installation failed with exit code ${code}\n${stderr}`,
          ),
        );

        return;
      }

      const bunPath = getInstalledBunPath();

      if (!bunPath) {
        reject(
          new Error(
            "Bun installation finished, but bun.exe could not be found.",
          ),
        );

        return;
      }

      console.log(`[JA-TUI] Bun installed: ${bunPath}`);

      resolve(bunPath);
    });
  });
}

async function getBunPath(): Promise<string> {
  const existingBun = getInstalledBunPath();

  if (existingBun) {
    return existingBun;
  }

  return installBun();
}

export const BUN_PATH = await getBunPath();

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface CommandOptions {
  cwd: string;
  onOutput?: (output: string) => void;
  onError?: (output: string) => void;
}

export function runCommand(
  args: string[],
  options: CommandOptions,
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(BUN_PATH, args, {
      cwd: options.cwd,
      windowsHide: false,
      stdio: ["inherit", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      const output = data.toString();

      stdout += output;
      options.onOutput?.(output);
    });

    child.stderr.on("data", (data: Buffer) => {
      const output = data.toString();

      stderr += output;
      options.onError?.(output);
    });

    child.on("error", reject);

    child.on("close", (code) => {
      resolve({
        code: code ?? -1,
        stdout,
        stderr,
      });
    });
  });
}

export async function runBun(
  args: string[],
  options: CommandOptions,
): Promise<CommandResult> {
  const result = await runCommand(args, options);

  if (result.code !== 0) {
    throw new Error(`Bun command failed with exit code ${result.code}`);
  }

  return result;
}

export async function bunCreate(
  args: string[],
  cwd: string,
  options?: Omit<CommandOptions, "cwd">,
) {
  return runBun(["create", ...args], {
    cwd,
    ...options,
  });
}

export async function bunInstall(
  cwd: string,
  options?: Omit<CommandOptions, "cwd">,
) {
  return runBun(["install"], {
    cwd,
    ...options,
  });
}

export async function bunAdd(
  packages: string[],
  cwd: string,
  options?: Omit<CommandOptions, "cwd">,
) {
  return runBun(["add", ...packages], {
    cwd,
    ...options,
  });
}

export async function bunX(
  args: string[],
  cwd: string,
  options?: Omit<CommandOptions, "cwd">,
) {
  return runBun(["x", ...args], {
    cwd,
    ...options,
  });
}
