// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as vscode from "vscode";

import { findExecutableInPath, isDirectory } from "../../paths";
import { SessionOptions } from "../../sessionOptions";
import {
  AdapterCommand,
  BackendContext,
  BackendError,
  DebuggerBackend,
} from "../backend";
import { buildGdbArgs } from "./arguments";
import { getQtPrettyPrintersArgs } from "./prettyPrinters";
import {
  getGdbVersion,
  isGdbVersionSufficient,
  MIN_GDB_VERSION,
} from "./version";

const [MIN_MAJOR, MIN_MINOR] = MIN_GDB_VERSION;

/** Drops the `undefined` values `NodeJS.ProcessEnv` allows but DAP's "env" doesn't. */
function toStringEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Drives `gdb -i dap`. The interesting logic lives in the vscode-free modules
 * next door, where it is unit-tested; this is the wiring that needs vscode.
 */
export class GdbBackend implements DebuggerBackend {
  readonly id = "gdb";
  readonly displayName = "gdb";
  readonly debugType = "kdap";
  readonly pathSettingKey = "kdap.gdb.path";
  readonly installHint = `Install GDB ${MIN_MAJOR}.${MIN_MINOR} or later`;

  findBinaryInPath(): Promise<string | undefined> {
    return findExecutableInPath("gdb");
  }

  async checkBinary(binaryPath: string): Promise<string | undefined> {
    const version = await getGdbVersion(binaryPath);
    if (!version) {
      return `Unable to determine the version of gdb at '${binaryPath}'. This extension requires gdb ${MIN_MAJOR}.${MIN_MINOR} or later.`;
    }
    if (!isGdbVersionSufficient(version)) {
      return `gdb at '${binaryPath}' is version ${version[0]}.${version[1]}, but this extension requires ${MIN_MAJOR}.${MIN_MINOR} or later.`;
    }
    return undefined;
  }

  async adapterCommand(
    options: SessionOptions,
    context: BackendContext,
  ): Promise<AdapterCommand | BackendError> {
    // Checked here rather than in the factory because "set sysroot" is gdb's
    // way of honouring it; a debugger that ignores sysroot has no business
    // refusing to start over one.
    if (options.sysroot && !(await isDirectory(options.sysroot))) {
      return {
        message: `sysroot path '${options.sysroot}' is not an existing folder.`,
      };
    }

    // Obtaining these may prompt the user to download them first, which is why
    // buildGdbArgs() takes them rather than deriving them.
    const prettyPrinterArgs = options.qtPrettyPrinters
      ? await getQtPrettyPrintersArgs(context.extensionContext)
      : [];

    return { args: buildGdbArgs(options, prettyPrinterArgs) };
  }

  /**
   * Makes a launch configuration's `env` add to the inferior's environment
   * rather than replace it.
   *
   * gdb's DAP launch handler calls `inf.clear_env()` before applying "env", so
   * whatever the configuration lists becomes the inferior's *entire*
   * environment - unlike every other DAP-based C/C++ extension (cppdbg,
   * codelldb), and losing PATH, HOME, LD_LIBRARY_PATH and friends in the
   * process. Resolving `env` to the merged result up front means gdb's
   * replacing behaviour only ever sees what the inferior should end up with.
   */
  resolveConfiguration(
    config: vscode.DebugConfiguration,
    options: SessionOptions,
  ): vscode.DebugConfiguration {
    const env: unknown = config["env"];
    if (typeof env !== "object" || env === null) {
      // Absent (so gdb leaves the inherited environment alone) or malformed.
      return config;
    }

    // The environment the inferior would have inherited: gdb's own, which is
    // what the descriptor factory launches it with.
    config["env"] = {
      ...toStringEnv(process.env),
      ...options.environment,
      ...env,
    };
    return config;
  }
}
