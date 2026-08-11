import { rm, mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

const outDir = join(root, "release");
const runtimeDir = join(outDir, "runtime");

await rm(outDir, { recursive: true, force: true });
await mkdir(runtimeDir, { recursive: true });

const result = await Bun.build({
  entrypoints: ["./src/main.ts"],

  compile: {
    outfile: "./release/JA-TUI.exe",
    target: "bun-windows-x64",

    windows: {
      title: "JA-TUI",
      publisher: "JA-TUI",
      description: "JA-TUI Web Project Generator",
      version: "1.0.0",
      copyright: "JA-TUI",
      hideConsole: false,
      icon: "./assets/ja-tui.ico",
    },
  },
});

if (!result.success) {
  console.error("Build failed.");

  for (const message of result.logs) {
    console.error(message);
  }

  process.exit(1);
}

console.log("JA-TUI built successfully.");
console.log("Copying Bun runtime...");

const bunPath = Bun.which("bun");

if (!bunPath) {
  throw new Error("Bun executable could not be found.");
}

await copyFile(bunPath, join(runtimeDir, "bun.exe"));

console.log("");
console.log("Build complete:");
console.log(join(outDir, "JA-TUI.exe"));
console.log(join(runtimeDir, "bun.exe"));
