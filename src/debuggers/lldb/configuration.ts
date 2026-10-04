// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

// Deliberately free of any `vscode` import, so that its tests can run under
// plain mocha instead of needing a VS Code instance.

import { SessionOptions } from "../../sessionOptions";

/**
 * Applies to `config` whatever lldb-dap expects as a DAP launch argument
 * rather than on its command line. This is the mirror image of gdb, which
 * takes nearly everything as an `-iex` command.
 *
 * Note what is *not* here: unlike gdb, lldb-dap merges "env" into the
 * environment the inferior inherits rather than replacing it, so it needs no
 * equivalent of gdb's inf.clear_env() workaround.
 *
 * `qtPrettyPrintersCommand` and `qmlFramesCommand` are passed in rather than
 * derived here because building them needs a `vscode.ExtensionContext` to
 * locate the bundled Python, which this module deliberately has no dependency
 * on.
 *
 * `qmlFramesCommand` imports the QML frame provider, which registers itself on
 * the target - so it goes in `preRunCommands`, the first point at which
 * lldb-dap has one, whether launching or attaching.
 */
export function applyLldbConfiguration(
  config: Record<string, unknown>,
  options: SessionOptions,
  qtPrettyPrintersCommand?: string,
  qmlFramesCommand?: string,
): void {
  // lldb-dap's "sourceMap" takes [from, to] pairs, and populates
  // target.source-map from them.
  const sourceMap = Object.entries(options.sourceFileMap);
  if (sourceMap.length !== 0) {
    config["sourceMap"] = sourceMap;
  }

  if (qtPrettyPrintersCommand) {
    appendCommand(config, "initCommands", qtPrettyPrintersCommand);
  }

  if (qmlFramesCommand) {
    appendCommand(config, "preRunCommands", qmlFramesCommand);
  }
}

/** Appends `command` to the `key` command list, after the caller's own. */
function appendCommand(
  config: Record<string, unknown>,
  key: string,
  command: string,
): void {
  const commands = Array.isArray(config[key]) ? (config[key] as unknown[]) : [];
  config[key] = [...commands, command];
}
