import {
  createCliRenderer,
  Text,
  Box,
  InputRenderable,
  InputRenderableEvents,
  ASCIIFontRenderable,
  ConsolePosition,
  type KeyEvent,
} from "@opentui/core";

import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";

import { bunCreate, bunInstall, bunAdd, bunX } from "../runtime/command-runner";

const APP_NAME = "JA-TUI";
const VERSION = "1.0.0";

type Step =
  | "project"
  | "directory"
  | "framework"
  | "ui"
  | "confirm"
  | "running";

type Framework = "React" | "Next.js" | "Vue" | "Svelte";

type UILibrary = "shadcn/ui" | "Tailwind CSS" | "Material UI" | "None";

interface ProjectConfig {
  name: string;
  directory: string;
  framework: Framework;
  ui: UILibrary;
}

const renderer = await createCliRenderer({
  exitOnCtrlC: true,

  consoleOptions: {
    position: ConsolePosition.BOTTOM,
    sizePercent: 30,
    colorInfo: "#00FFFF",
    colorWarn: "#FFFF00",
    colorError: "#FF0000",
    startInDebugMode: false,
  },

  onDestroy() {
    console.info("[JA-TUI] Renderer destroyed.");
  },
});

const state: {
  step: Step;
  project: Partial<ProjectConfig>;
} = {
  step: "project",
  project: {},
};

function notify(message: string) {
  if (renderer.capabilities?.notifications) {
    renderer.triggerNotification(message, APP_NAME);
  }
}

function logInfo(message: string) {
  console.info(`[JA-TUI] ${message}`);
}

function logWarn(message: string) {
  console.warn(`[JA-TUI] ${message}`);
}

function logError(message: string) {
  console.error(`[JA-TUI] ${message}`);
}

function clearScreen() {
  for (const child of renderer.root.getChildren()) {
    renderer.root.remove(child);
  }
}

function createTitle() {
  return new ASCIIFontRenderable(renderer, {
    id: "title",
    text: "JA-TUI",
    font: "tiny",
    color: "#7700ff",
  });
}

function createHeader() {
  return Box(
    {
      padding: 1,
      flexDirection: "column",
      alignItems: "center",
      gap: 1,
    },

    createTitle(),

    Text({
      content: `v${VERSION}`,
      fg: "#AAAAAA",
    }),
  );
}

function createOption(number: number, label: string, description?: string) {
  const items = [
    Text({
      content: `[${number}] ${label}`,
      fg: "#FFFFFF",
    }),
  ];

  if (description) {
    items.push(
      Text({
        content: description,
        fg: "#777777",
      }),
    );
  }

  return Box(
    {
      flexDirection: "column",
      gap: 0,
    },
    ...items,
  );
}

function createInput(
  id: string,
  placeholder: string,
  onEnter: (value: string) => void | Promise<void>,
) {
  const input = new InputRenderable(renderer, {
    id,
    width: 60,
    placeholder,
    textColor: "#FFFFFF",
    cursorColor: "#7700FF",
    focusedBackgroundColor: "#16121F",
  });

  input.on(InputRenderableEvents.ENTER, async (value) => {
    if (state.step !== "project") {
      return;
    }

    await onEnter(value.trim());
  });

  return input;
}

function showProjectStep() {
  state.step = "project";
  clearScreen();

  const input = createInput(
    "project-name",
    "my-project-name",
    async (value) => {
      if (state.step !== "project") {
        return;
      }

      if (!value) {
        notify("Project name is required");
        return;
      }

      if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
        notify("Invalid project name");
        logWarn("Project name contains invalid characters.");
        return;
      }

      state.project.name = value;

      logInfo(`Project name: ${value}`);

      showDirectoryStep();
    },
  );

  renderer.root.add(
    Box(
      {
        flexDirection: "column",
        padding: 1,
        gap: 1,
      },

      createHeader(),

      Text({
        content: "NEW WEB PROJECT",
        fg: "#7700FF",
      }),

      input,
    ),
  );

  input.focus();
}

async function selectDirectory(): Promise<string | null> {
  if (process.platform !== "win32") {
    notify("Directory selection is only available on Windows");
    return null;
  }

  return new Promise((resolve) => {
    const script = `
Add-Type -AssemblyName System.Windows.Forms

$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = "Select project directory"
$dialog.ShowNewFolderButton = $true

if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $dialog.SelectedPath
}
`;

    const powershell = spawn(
      "powershell.exe",
      ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", script],
      {
        windowsHide: false,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";

    powershell.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    powershell.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    powershell.on("error", (error) => {
      logError(`PowerShell error: ${error.message}`);
      notify("Could not open directory selector");
      resolve(null);
    });

    powershell.on("close", (code) => {
      const directory = stdout.trim();

      if (code !== 0) {
        if (stderr.trim()) {
          logError(stderr.trim());
        }

        notify("Directory selector failed");
        resolve(null);
        return;
      }

      if (!directory) {
        logInfo("Directory selection cancelled.");
        resolve(null);
        return;
      }

      resolve(directory);
    });
  });
}

function showDirectoryStep() {
  state.step = "directory";
  clearScreen();

  renderer.root.add(
    Box(
      {
        flexDirection: "column",
        padding: 1,
        gap: 1,
      },

      createHeader(),

      Text({
        content: "PROJECT DIRECTORY",
        fg: "#7700FF",
      }),

      Text({
        content: "Press [ENTER] to choose Directory",
        fg: "#AAAAAA",
      }),
    ),
  );
}

function showFrameworkStep() {
  state.step = "framework";
  clearScreen();

  renderer.root.add(
    Box(
      {
        flexDirection: "column",
        padding: 1,
        gap: 1,
      },

      createHeader(),

      Text({
        content: "FRAMEWORK",
        fg: "#7700FF",
      }),

      Text({
        content: "Choose your framework",
        fg: "#AAAAAA",
      }),

      Text({
        content: "",
      }),

      createOption(1, "React", "Vite + React + TypeScript"),

      createOption(2, "Next.js", "Next.js application"),

      createOption(3, "Vue", "Vue + Vite"),

      createOption(4, "Svelte", "Svelte application"),

      Text({
        content: "",
      }),

      Text({
        content: "Enter 1-4",
        fg: "#555555",
      }),
    ),
  );
}

function showUIOptions() {
  state.step = "ui";
  clearScreen();

  renderer.root.add(
    Box(
      {
        flexDirection: "column",
        padding: 1,
        gap: 1,
      },

      createHeader(),

      Text({
        content: "UI LIBRARY",
        fg: "#7700FF",
      }),

      Text({
        content: "Choose your UI stack",
        fg: "#AAAAAA",
      }),

      Text({
        content: "",
      }),

      createOption(1, "shadcn/ui", "Composable UI components"),

      createOption(2, "Tailwind CSS", "Utility-first CSS"),

      createOption(3, "Material UI", "React component library"),

      createOption(4, "None", "No UI library"),

      Text({
        content: "",
      }),

      Text({
        content: "Enter 1-4",
        fg: "#555555",
      }),
    ),
  );
}

function showConfirmation() {
  state.step = "confirm";
  clearScreen();

  const project = state.project as ProjectConfig;

  renderer.root.add(
    Box(
      {
        flexDirection: "column",
        padding: 1,
        gap: 1,
      },

      createHeader(),

      Text({
        content: "PROJECT INGREDIENTS",
        fg: "#7700FF",
      }),

      Text({
        content: "",
      }),

      Text({
        content: `Project      ${project.name}`,
        fg: "#FFFFFF",
      }),

      Text({
        content: `Directory    ${project.directory}`,
        fg: "#FFFFFF",
      }),

      Text({
        content: `Framework    ${project.framework}`,
        fg: "#FFFFFF",
      }),

      Text({
        content: `UI Library   ${project.ui}`,
        fg: "#FFFFFF",
      }),

      Text({
        content: "",
      }),

      Text({
        content: "ENTER  Create project",
        fg: "#00e498",
      }),

      Text({
        content: "ESC    Cancel",
        fg: "#AAAAAA",
      }),
    ),
  );
}

function showRunning(project: ProjectConfig) {
  state.step = "running";
  clearScreen();

  renderer.root.add(
    Box(
      {
        flexDirection: "column",
        padding: 1,
        gap: 1,
      },

      createHeader(),

      Text({
        content: "CREATING PROJECT",
        fg: "#7700FF",
      }),

      Text({
        content: project.name,
        fg: "#FFFFFF",
      }),

      Text({
        content: project.directory,
        fg: "#AAAAAA",
      }),

      Text({
        content: "",
      }),

      Text({
        content: "Setting things up...",
        fg: "#AAAAAA",
      }),
    ),
  );
}

function showCreated(project: ProjectConfig, projectDirectory: string) {
  state.step = "running";
  clearScreen();

  renderer.root.add(
    Box(
      {
        flexDirection: "column",
        padding: 1,
        gap: 1,
      },

      createHeader(),

      Text({
        content: "PROJECT CREATED",
        fg: "#00FFFF",
      }),

      Text({
        content: project.name,
        fg: "#FFFFFF",
      }),

      Text({
        content: projectDirectory,
        fg: "#AAAAAA",
      }),

      Text({
        content: "",
      }),

      Text({
        content: "Press ESC to exit.",
        fg: "#555555",
      }),
    ),
  );
}

function showFailed() {
  state.step = "running";
  clearScreen();

  renderer.root.add(
    Box(
      {
        flexDirection: "column",
        padding: 1,
        gap: 1,
      },

      createHeader(),

      Text({
        content: "PROJECT CREATION FAILED",
        fg: "#FF0000",
      }),

      Text({
        content: "Check the console for details.",
        fg: "#AAAAAA",
      }),

      Text({
        content: "",
      }),

      Text({
        content: "Press ESC to exit.",
        fg: "#555555",
      }),
    ),
  );
}

async function createFramework(project: ProjectConfig) {
  switch (project.framework) {
    case "React":
      await bunCreate(
        ["vite", project.name, "--template", "react-ts"],
        project.directory,
        {
          onOutput: (output) => {
            console.info(output.trim());
          },

          onError: (output) => {
            console.warn(output.trim());
          },
        },
      );
      break;

    case "Next.js":
      await bunX(["create-next-app@latest", project.name], project.directory, {
        onOutput: (output) => {
          console.info(output.trim());
        },

        onError: (output) => {
          console.warn(output.trim());
        },
      });
      break;

    case "Vue":
      await bunCreate(["vue", project.name], project.directory, {
        onOutput: (output) => {
          console.info(output.trim());
        },

        onError: (output) => {
          console.warn(output.trim());
        },
      });
      break;

    case "Svelte":
      await bunX(["sv", "create", project.name], project.directory, {
        onOutput: (output) => {
          console.info(output.trim());
        },

        onError: (output) => {
          console.warn(output.trim());
        },
      });
      break;
  }
}

async function installDependencies(projectDirectory: string) {
  await bunInstall(projectDirectory, {
    onOutput: (output) => {
      console.info(output.trim());
    },

    onError: (output) => {
      console.warn(output.trim());
    },
  });
}

async function installUILibrary(
  project: ProjectConfig,
  projectDirectory: string,
) {
  switch (project.ui) {
    case "Tailwind CSS":
      await bunAdd(["tailwindcss", "@tailwindcss/vite"], projectDirectory, {
        onOutput: (output) => {
          console.info(output.trim());
        },

        onError: (output) => {
          console.warn(output.trim());
        },
      });
      break;

    case "shadcn/ui":
      await bunX(["shadcn@latest", "init"], projectDirectory, {
        onOutput: (output) => {
          console.info(output.trim());
        },

        onError: (output) => {
          console.warn(output.trim());
        },
      });
      break;

    case "Material UI":
      await bunAdd(
        ["@mui/material", "@emotion/react", "@emotion/styled"],
        projectDirectory,
        {
          onOutput: (output) => {
            console.info(output.trim());
          },

          onError: (output) => {
            console.warn(output.trim());
          },
        },
      );
      break;

    case "None":
      break;
  }
}

async function executeCommands(project: ProjectConfig) {
  state.step = "running";

  const projectDirectory = `${project.directory}\\${project.name}`;

  showRunning(project);

  logInfo("Starting project creation.");
  logInfo(`Parent directory: ${project.directory}`);
  logInfo(`Project directory: ${projectDirectory}`);

  notify("Creating project");

  try {
    await createFramework(project);

    logInfo("Framework created.");

    await installDependencies(projectDirectory);

    logInfo("Dependencies installed.");

    await installUILibrary(project, projectDirectory);

    logInfo("Project setup completed.");

    notify("Project created successfully");

    showCreated(project, projectDirectory);
  } catch (error) {
    logError("Project creation failed.");

    if (error instanceof Error) {
      logError(error.message);
    } else {
      logError(String(error));
    }

    notify("Project creation failed");

    showFailed();
  }
}

renderer.keyInput.on("keypress", async (key: KeyEvent) => {
  if (state.step === "directory") {
    if (key.name === "return") {
      const directory = await selectDirectory();

      if (!directory) {
        notify("Directory selection cancelled");
        return;
      }

      if (!existsSync(directory)) {
        notify("Directory does not exist");
        logWarn(`Selected directory does not exist: ${directory}`);
        return;
      }

      if (!statSync(directory).isDirectory()) {
        notify("Selected path is not a directory");
        return;
      }

      state.project.directory = directory;

      logInfo(`Directory selected: ${directory}`);

      showFrameworkStep();

      return;
    }

    if (key.name === "escape") {
      logWarn("Project creation cancelled.");

      notify("Project creation cancelled");

      renderer.destroy();
    }

    return;
  }

  if (state.step === "framework") {
    const frameworks: Framework[] = ["React", "Next.js", "Vue", "Svelte"];

    if (["1", "2", "3", "4"].includes(key.name)) {
      const framework = frameworks[Number(key.name) - 1];

      state.project.framework = framework;

      logInfo(`Framework selected: ${framework}`);

      showUIOptions();
    }

    return;
  }

  if (state.step === "ui") {
    const libraries: UILibrary[] = [
      "shadcn/ui",
      "Tailwind CSS",
      "Material UI",
      "None",
    ];

    if (["1", "2", "3", "4"].includes(key.name)) {
      const ui = libraries[Number(key.name) - 1];

      state.project.ui = ui;

      logInfo(`UI library selected: ${ui}`);

      showConfirmation();
    }

    return;
  }

  if (state.step === "confirm") {
    if (key.name === "return") {
      await executeCommands(state.project as ProjectConfig);

      return;
    }

    if (key.name === "escape") {
      logWarn("Project creation cancelled.");

      notify("Project creation cancelled");

      renderer.destroy();
    }

    return;
  }

  if (state.step === "running") {
    if (key.name === "escape") {
      renderer.destroy();
    }
  }
});

process.on("uncaughtException", (error) => {
  logError(error.message);
  renderer.destroy();
});

process.on("unhandledRejection", (error) => {
  logError(String(error));
  renderer.destroy();
});

showProjectStep();
