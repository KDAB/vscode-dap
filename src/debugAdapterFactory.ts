// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "path";
import { promisify } from "node:util";
import * as vscode from "vscode";

import { getQtPrettyPrintersArgs } from "./gdbPrettyPrinters";

const execFileAsync = promisify(execFile);

/**
 * The lowest gdb version whose DAP support this extension relies on. 16.1 is
 * where gdb defers starting the inferior to "configurationDone"; before that,
 * "launch" ran the program immediately, so breakpoints sent after
 * "initialized" arrived too late and "stopOnEntry" was ignored.
 */
export const MIN_GDB_VERSION: readonly [number, number] = [16, 1];

/**
 * Whether `filePath` is a regular file the current user can execute. The
 * `isFile()` check matters because `X_OK` also succeeds on any directory with
 * search permission, so pointing `kdap.gdbPath` at a bin directory instead of
 * the gdb binary would otherwise only fail later, when gdb is run.
 */
export async function isExecutable(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return false;
    }
    await fs.access(filePath, fs.constants.X_OK);
  } catch {
    return false;
  }
  return true;
}

/** Whether `dirPath` exists and is a directory. */
export async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    return (await fs.stat(dirPath)).isDirectory();
  } catch {
    return false;
  }
}

/** Parses the "X.Y" version out of gdb's `--version` first line, e.g. "GNU gdb (Ubuntu 15.2-0ubuntu1) 15.2". */
export function parseGdbVersion(
  versionOutput: string,
): [number, number] | undefined {
  const match = /^GNU gdb.*?(\d+)\.(\d+)/.exec(versionOutput);
  if (!match) {
    return undefined;
  }
  return [Number(match[1]), Number(match[2])];
}

export function isGdbVersionSufficient(
  version: readonly [number, number],
): boolean {
  const [major, minor] = version;
  const [minMajor, minMinor] = MIN_GDB_VERSION;
  return major > minMajor || (major === minMajor && minor >= minMinor);
}

/** Runs `gdb --version` and parses the result. Returns undefined if gdb can't be run or its version can't be parsed. */
export async function getGdbVersion(
  gdbPath: string,
): Promise<[number, number] | undefined> {
  try {
    const { stdout } = await execFileAsync(gdbPath, ["--version"]);
    return parseGdbVersion(stdout);
  } catch {
    return undefined;
  }
}

/**
 * Expands a leading `~` to the user's home directory. VS Code never does this
 * itself, not even for launch configuration values, so it applies to both
 * settings and launch configurations.
 */
export function expandTilde(value: string): string {
  if (value === "~" || value.startsWith("~/")) {
    return path.join(os.homedir(), value.slice(1));
  }
  return value;
}

/**
 * Expands `${workspaceFolder}` and a leading `~` in values read from the
 * `kdap.*` settings. Unlike launch configuration values, settings read via
 * `vscode.workspace.getConfiguration()` are not substituted by VS Code, so
 * the extension has to do it itself.
 */
function expandConfigPath(
  value: string,
  workspaceFolder: vscode.WorkspaceFolder | undefined,
): string {
  return expandTilde(
    value.replace(/\$\{workspaceFolder\}/g, workspaceFolder?.uri.fsPath ?? ""),
  );
}

async function findExecutableInPath(name: string): Promise<string | undefined> {
  const envPath = process.env["PATH"];
  if (!envPath) {
    return undefined;
  }

  for (const dir of envPath.split(path.delimiter)) {
    const candidate = path.join(dir, name);
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * A bare command name (e.g. "gdb-multiarch") isn't resolved via PATH by
 * `fs.access`, so look it up ourselves. Values containing a path separator
 * are left untouched.
 */
async function resolveGdbPath(value: string): Promise<string> {
  if (value.includes(path.sep)) {
    return value;
  }
  return (await findExecutableInPath(value)) ?? value;
}

async function getGdbPath(
  session: vscode.DebugSession,
): Promise<string | undefined> {
  // Explicit path in the launch configuration takes priority.
  const launchConfigPath: unknown = session.configuration["gdbPath"];
  if (typeof launchConfigPath === "string" && launchConfigPath.length !== 0) {
    // VS Code substitutes ${workspaceFolder} in launch.json, but not `~`.
    return resolveGdbPath(expandTilde(launchConfigPath));
  }

  // Then the extension's own setting.
  const config = vscode.workspace.getConfiguration(
    "kdap",
    session.workspaceFolder,
  );
  const configPath = config.get<string>("gdbPath");
  if (configPath && configPath.length !== 0) {
    return resolveGdbPath(
      expandConfigPath(configPath, session.workspaceFolder),
    );
  }

  // Fall back to searching PATH.
  return findExecutableInPath("gdb");
}

/**
 * Launches gdb in DAP mode (`gdb -i dap`) for a debug session, resolving
 * which gdb binary to use from the launch configuration, extension settings,
 * or PATH, in that order.
 */
export class GDBDapDescriptorFactory
  implements vscode.DebugAdapterDescriptorFactory, vscode.Disposable
{
  constructor(private readonly context: vscode.ExtensionContext) {}

  dispose() {}

  async createDebugAdapterDescriptor(
    session: vscode.DebugSession,
  ): Promise<vscode.DebugAdapterDescriptor | undefined> {
    const gdbPath = await getGdbPath(session);
    if (!gdbPath || !(await isExecutable(gdbPath))) {
      await GDBDapDescriptorFactory.showGdbNotFoundMessage(gdbPath);
      return undefined;
    }

    const version = await getGdbVersion(gdbPath);
    if (!version || !isGdbVersionSufficient(version)) {
      await GDBDapDescriptorFactory.showGdbVersionTooOldMessage(
        gdbPath,
        version,
      );
      return undefined;
    }

    const config = vscode.workspace.getConfiguration(
      "kdap",
      session.workspaceFolder,
    );

    const args: string[] = ["-i", "dap"];

    const sysroot: unknown = session.configuration["sysroot"];
    if (typeof sysroot === "string" && sysroot.length !== 0) {
      // VS Code substitutes ${workspaceFolder} in launch.json, but not `~`.
      const sysrootPath = expandTilde(sysroot);
      if (!(await isDirectory(sysrootPath))) {
        await GDBDapDescriptorFactory.showSysrootNotFoundMessage(sysrootPath);
        return undefined;
      }
      args.push("-iex", `set sysroot ${sysrootPath}`);
    }

    const logPath = config.get<string>("logPath");
    if (logPath) {
      args.push(
        "-iex",
        `set debug dap-log-file ${expandConfigPath(logPath, session.workspaceFolder)}`,
      );
    }

    const logLevel = config.get<number>("logLevel");
    if (logPath && logLevel !== undefined) {
      args.push("-iex", `set debug dap-log-level ${logLevel}`);
    }

    if (config.get<boolean>("qtPrettyPrinters")) {
      args.push(...(await getQtPrettyPrintersArgs(this.context)));
    }

    // VS Code merges this into the extension host's own environment, so gdb
    // ends up with `process.env` plus these. GDBDapConfigurationProvider
    // relies on that when it works out what the inferior inherits.
    const environment = config.get<{ [key: string]: string }>("environment");
    const options = environment ? { env: { ...environment } } : undefined;

    return new vscode.DebugAdapterExecutable(gdbPath, args, options);
  }

  /** Shows a message box when the gdb executable can't be found. */
  static async showGdbNotFoundMessage(gdbPath?: string) {
    const message = gdbPath
      ? `gdb path '${gdbPath}' is not a valid executable.`
      : `Unable to find gdb. Install GDB ${MIN_GDB_VERSION[0]}.${MIN_GDB_VERSION[1]} or later, or set kdap.gdbPath.`;
    const openSettingsAction = "Open Settings";
    const choice = await vscode.window.showErrorMessage(
      message,
      openSettingsAction,
    );

    if (choice === openSettingsAction) {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "kdap.gdbPath",
      );
    }
  }

  /** Shows a message box when the launch configuration's `sysroot` doesn't point at an existing folder. */
  static async showSysrootNotFoundMessage(sysrootPath: string) {
    await vscode.window.showErrorMessage(
      `sysroot path '${sysrootPath}' is not an existing folder.`,
    );
  }

  /** Shows a message box when the gdb executable's version is too old, or couldn't be determined. */
  static async showGdbVersionTooOldMessage(
    gdbPath: string,
    version: [number, number] | undefined,
  ) {
    const [minMajor, minMinor] = MIN_GDB_VERSION;
    const message = version
      ? `gdb at '${gdbPath}' is version ${version[0]}.${version[1]}, but this extension requires ${minMajor}.${minMinor} or later.`
      : `Unable to determine the version of gdb at '${gdbPath}'. This extension requires gdb ${minMajor}.${minMinor} or later.`;
    const openSettingsAction = "Open Settings";
    const choice = await vscode.window.showErrorMessage(
      message,
      openSettingsAction,
    );

    if (choice === openSettingsAction) {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "kdap.gdbPath",
      );
    }
  }
}
