// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

// Deliberately free of any `vscode` import, so that its tests can run under
// plain mocha instead of needing a VS Code instance.

import { expandTilde } from "./paths";
import { KdapSettings } from "./settings";

/**
 * A launch configuration, as far as this module cares: `vscode.DebugConfiguration`
 * without the vscode dependency.
 */
export type LaunchConfiguration = Readonly<Record<string, unknown>>;

/**
 * What a launch configuration and the `kdap.*` settings ask the debugger to
 * do, in debugger-independent terms. Every debugger expresses these somehow,
 * even if the mechanism differs - as a command-line flag, a startup command,
 * or a DAP launch argument.
 *
 * Only intents that make sense for more than one debugger belong here.
 * Properties specific to a single debugger stay in the launch configuration
 * and are read by that debugger's own code, rather than being widened into a
 * lowest common denominator.
 */
export interface SessionOptions {
  /** Don't read the debugger's own init files. */
  readonly skipInitFiles: boolean;
  /** Where to look for shared libraries and debug info, with `~` expanded. */
  readonly sysroot: string | undefined;
  /** Source paths as recorded in the debug info, mapped to where they are on disk. */
  readonly sourceFileMap: Readonly<Record<string, string>>;
  /** Where the debugger should write its DAP log, or undefined to disable logging. */
  readonly logPath: string | undefined;
  /** Only meaningful when `logPath` is set. */
  readonly logLevel: number | undefined;
  /** From the launch configuration; false unless explicitly enabled there. */
  readonly qtPrettyPrinters: boolean;
  /** Extra environment variables for the debugger process itself. */
  readonly environment: Readonly<Record<string, string>> | undefined;
}

/** Reads a string property, treating an empty or non-string value as absent. */
function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length !== 0 ? value : undefined;
}

/** Reads a boolean property, treating a non-boolean value as absent. */
function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/**
 * Values in launch.json have had `${workspaceFolder}` and friends substituted
 * by VS Code before the configuration reaches us, but never a leading `~`.
 */
function parseSourceFileMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [from, to] of Object.entries(value as Record<string, unknown>)) {
    if (typeof to === "string") {
      result[from] = expandTilde(to);
    }
  }
  return result;
}

export function parseSessionOptions(
  config: LaunchConfiguration,
  settings: KdapSettings,
): SessionOptions {
  const sysroot = optionalString(config["sysroot"]);

  return {
    skipInitFiles: config["skipInitFiles"] === true,
    sysroot: sysroot && expandTilde(sysroot),
    sourceFileMap: parseSourceFileMap(config["sourceFileMap"]),
    logPath: settings.logPath,
    logLevel: settings.logLevel,
    qtPrettyPrinters: optionalBoolean(config["qtPrettyPrinters"]) ?? false,
    environment: settings.environment,
  };
}
