// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as vscode from "vscode";

import { findVersionedExecutableInPath } from "../../paths";
import { SessionOptions } from "../../sessionOptions";
import { AdapterCommand, DebuggerBackend } from "../backend";
import { buildLldbAdapterCommand } from "./arguments";
import { applyLldbConfiguration } from "./configuration";

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

  findBinaryInPath(): Promise<string | undefined> {
    return findVersionedExecutableInPath("lldb-dap");
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
  ): vscode.DebugConfiguration {
    applyLldbConfiguration(config, options);
    return config;
  }
}
