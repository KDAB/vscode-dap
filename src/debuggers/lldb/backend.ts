// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as path from "path";
import * as vscode from "vscode";

import {
  findInDeveloperToolchain,
  findVersionedExecutableInPath,
} from "../../paths";
import { SessionOptions } from "../../sessionOptions";
import { AdapterCommand, BackendContext, DebuggerBackend } from "../backend";
import { buildLldbAdapterCommand } from "./arguments";
import { applyLldbConfiguration } from "./configuration";

/** Absolute path to the Qt pretty-printers bundled with this extension. */
function qtPrettyPrintersDir(context: vscode.ExtensionContext): string {
  return context.asAbsolutePath(path.join("printers", "lldb", "qt"));
}

/**
 * Drives lldb-dap, LLDB's own DAP adapter binary.
 *
 * No version check: unlike gdb, whose DAP support only became usable in 16.1,
 * lldb-dap has no comparable cliff. It also couldn't be checked reliably -
 * `lldb-dap --version` prints nothing at all in LLVM 20.
 *
 * The interesting logic lives in the vscode-free modules next door, where it
 * is unit-tested; this is the wiring that needs vscode.
 */
export class LldbBackend implements DebuggerBackend {
  readonly id = "lldb";
  readonly displayName = "lldb-dap";
  readonly debugType = "kdap-lldb";
  readonly pathSettingKey = "kdap.lldb.path";
  readonly installHint = "Install LLDB, including its lldb-dap binary";

  /**
   * PATH first, then the developer toolchain: a binary the user has put on
   * PATH is the one they have chosen to mean "lldb-dap", while on macOS the
   * usual case is that there is none, because Xcode keeps lldb-dap inside
   * the developer directory instead. Nothing else has to change for that
   * platform - Apple's own copy is signed for debugging, whereas a
   * PATH-installed one may not be.
   */
  async findBinaryInPath(): Promise<string | undefined> {
    return (
      (await findVersionedExecutableInPath("lldb-dap")) ??
      (await findInDeveloperToolchain("lldb-dap"))
    );
  }

  checkBinary(): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }

  adapterCommand(options: SessionOptions): Promise<AdapterCommand> {
    const { args, env, unsupported } = buildLldbAdapterCommand(options);
    return Promise.resolve({ args, env, unsupported });
  }

  resolveConfiguration(
    config: vscode.DebugConfiguration,
    options: SessionOptions,
    context: BackendContext,
  ): vscode.DebugConfiguration {
    // Bundled with this extension rather than downloaded, so - unlike gdb's
    // printers - there is nothing to fetch and nothing that can be missing.
    const qtPrettyPrintersCommand = options.qtPrettyPrinters
      ? `command script import ${JSON.stringify(qtPrettyPrintersDir(context.extensionContext))}`
      : undefined;
    applyLldbConfiguration(config, options, qtPrettyPrintersCommand);
    return config;
  }
}
