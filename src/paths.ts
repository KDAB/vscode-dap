// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

// Deliberately free of any `vscode` import, so that its tests can run under
// plain mocha instead of needing a VS Code instance. Callers that hold a
// `vscode.WorkspaceFolder` pass its `uri.fsPath` rather than the folder.

import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Whether `filePath` is a regular file the current user can execute. The
 * `isFile()` check matters because `X_OK` also succeeds on any directory with
 * search permission, so pointing a debugger path setting at a bin directory
 * instead of the binary would otherwise only fail later, when it is run.
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

/** Whether `filePath` exists and is a regular file. */
export async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch {
    return false;
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
 * Expands `${workspaceFolder}` and a leading `~`. VS Code substitutes
 * `${workspaceFolder}` in launch.json before handing a configuration over, but
 * not in values read via `vscode.workspace.getConfiguration()` nor in
 * configurations read straight out of settings, so those have to be expanded
 * here.
 */
export function expandConfigPath(
  value: string,
  workspaceFolderPath: string | undefined,
): string {
  return expandTilde(
    value.replace(/\$\{workspaceFolder\}/g, workspaceFolderPath ?? ""),
  );
}

/** The first entry in PATH named `name` that is executable, if any. */
export async function findExecutableInPath(
  name: string,
): Promise<string | undefined> {
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
 * Finds an executable named `name`, or `name-<number>` when there is no plain
 * `name`. Distributions often ship only the suffixed form - Ubuntu's llvm
 * packages install `lldb-dap-20` and no `lldb-dap` - so looking for the bare
 * name alone finds nothing on a machine that has the tool installed.
 *
 * The unsuffixed name wins wherever it appears in PATH, on the grounds that it
 * is what the system has been set up to mean; otherwise the highest suffix
 * does.
 */
export async function findVersionedExecutableInPath(
  name: string,
): Promise<string | undefined> {
  const envPath = process.env["PATH"];
  if (!envPath) {
    return undefined;
  }

  const suffixed = new RegExp(`^${name}-(\\d+)$`);
  let best: { version: number; path: string } | undefined;

  for (const dir of envPath.split(path.delimiter)) {
    const exact = path.join(dir, name);
    if (await isExecutable(exact)) {
      return exact;
    }

    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const match = suffixed.exec(entry);
      if (!match) {
        continue;
      }
      const version = Number(match[1]);
      if (best && best.version >= version) {
        continue;
      }
      const candidate = path.join(dir, entry);
      if (await isExecutable(candidate)) {
        best = { version, path: candidate };
      }
    }
  }

  return best?.path;
}

/** How long to wait for `xcrun` before giving up on it. */
const TOOLCHAIN_QUERY_TIMEOUT_MS = 10_000;

/**
 * The path to `name` inside the active developer toolchain, if it has one.
 *
 * This exists for tools a platform keeps outside PATH entirely: macOS ships
 * some of its toolchain inside the Xcode or Command Line Tools directory
 * that `xcode-select` points at, so a PATH search finds nothing at all even
 * though the tool is installed. `xcrun -f` is the documented way to ask
 * where it really is, and it answers for whichever developer directory is
 * currently selected.
 *
 * Returns undefined wherever there is no such toolchain to ask - every
 * platform but macOS - and on each way the query can fail: no Command Line
 * Tools installed, `xcode-select` pointing at a directory that has since
 * been removed, or a toolchain that simply doesn't carry `name`. A toolchain
 * is a fallback for callers that have already searched PATH, so none of
 * those is worth reporting as an error in its own right.
 */
export async function findInDeveloperToolchain(
  name: string,
): Promise<string | undefined> {
  if (process.platform !== "darwin") {
    return undefined;
  }

  let stdout: string;
  try {
    ({ stdout } = await execFileAsync("xcrun", ["-f", name], {
      timeout: TOOLCHAIN_QUERY_TIMEOUT_MS,
    }));
  } catch {
    return undefined;
  }

  // xcrun prints the path and nothing else, but it reports a tool it can't
  // find by exit status rather than by printing an empty line, so an empty
  // answer would be a surprise rather than the normal "not found".
  const found = stdout.trim();
  if (!found) {
    return undefined;
  }

  // Vetted the same way a PATH hit is: xcrun answers from its own index of
  // the toolchain, which can still name a tool that isn't there any more.
  return (await isExecutable(found)) ? found : undefined;
}

/**
 * A bare command name (e.g. "gdb-multiarch") isn't resolved via PATH by
 * `fs.access`, so look it up ourselves. Values containing a path separator are
 * left untouched.
 */
export async function resolveExecutablePath(value: string): Promise<string> {
  if (value.includes(path.sep)) {
    return value;
  }
  return (await findExecutableInPath(value)) ?? value;
}
