// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as vscode from "vscode";

import { SessionOptions } from "../sessionOptions";

/** How to spawn a debug adapter, minus the binary itself. */
export interface AdapterCommand {
  readonly args: readonly string[];
  /**
   * Extra environment for the adapter process. VS Code merges this into the
   * extension host's own environment rather than replacing it.
   */
  readonly env?: Readonly<Record<string, string>>;
  /**
   * Options the user asked for that this debugger can't honour, named as the
   * user spelled them. Reported once when the session starts: silently
   * ignoring a configured option is worse than saying so.
   */
  readonly unsupported?: readonly string[];
}

/** A reason not to start the session, to be reported to the user by the caller. */
export interface BackendError {
  readonly message: string;
}

export function isBackendError(
  result: AdapterCommand | BackendError,
): result is BackendError {
  return "message" in result;
}

/**
 * One debugger this extension knows how to drive.
 *
 * The extension's whole job is to work out which binary to run, what to pass
 * it, and how to fix up the launch configuration on the way. All three differ
 * per debugger and nothing else does, so this is the only place where a
 * debugger is named: everything outside `src/debuggers/` works against this
 * interface.
 *
 * The interface deliberately covers both argv and the launch configuration.
 * gdb expresses almost everything as an `-iex` command, because its DAP
 * handler ignores launch arguments it doesn't know about, while lldb-dap
 * expresses most of the same things as DAP launch arguments. A backend that
 * could only build a command line would not be able to describe the second.
 */
export interface DebuggerBackend {
  /** Stable identifier, used in settings and test selectors. */
  readonly id: string;
  /** The debugger's own name, as it should appear in messages to the user. */
  readonly displayName: string;
  /** The debug type this backend is registered for, as contributed in package.json. */
  readonly debugType: string;
  /** The setting the user is pointed at when the binary is missing or unusable. */
  readonly pathSettingKey: string;
  /** What to do about a missing binary, e.g. "Install GDB 16.1 or later". */
  readonly installHint: string;

  /**
   * Finds this debugger's binary in PATH. Each debugger knows how its binary
   * is named, which is not always one fixed name.
   */
  findBinaryInPath(): Promise<string | undefined>;

  /**
   * Checks that a binary can actually serve as this debug adapter. Returns a
   * message explaining why not, or undefined when it is fine.
   */
  checkBinary(binaryPath: string): Promise<string | undefined>;

  /**
   * Renders `options` into a command line for this debugger. May prompt the
   * user, so it is async.
   */
  adapterCommand(
    options: SessionOptions,
    context: BackendContext,
  ): Promise<AdapterCommand | BackendError>;

  /**
   * Rewrites a launch configuration before the session starts, for whatever
   * this debugger needs expressed as a DAP launch argument rather than on its
   * command line.
   */
  resolveConfiguration(
    config: vscode.DebugConfiguration,
    options: SessionOptions,
    context: BackendContext,
  ): vscode.DebugConfiguration;
}

/** What a backend may need beyond the session options themselves. */
export interface BackendContext {
  readonly extensionContext: vscode.ExtensionContext;
}
