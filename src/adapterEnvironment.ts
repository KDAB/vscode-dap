// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

// Deliberately free of any `vscode` import, so that its tests can run under
// plain mocha instead of needing a VS Code instance.

import { SessionOptions } from "./sessionOptions";

/** The environment variable elfutils' debuginfod client reads to decide where to query for missing debug symbols. */
const DEBUGINFOD_ENV_VAR = "DEBUGINFOD_URLS";

/**
 * Sets this extension's own hang-avoidance default even when `hostEnv`
 * already has {@link DEBUGINFOD_ENV_VAR} set. Meant for CI: a test runner's
 * job env can set `DEBUGINFOD_URLS=""` itself and still see it clobbered
 * before the adapter process actually spawns, e.g. by a login shell along
 * the way re-sourcing a distro profile script that exports it - a value
 * this variable's own name is never going to collide with.
 */
const DISABLE_DEBUGINFOD_ENV_VAR = "KDAB_DAP_DISABLE_DEBUGINFOD";

/**
 * Builds the environment a debug adapter process is spawned with:
 * `kdap.environment`, overridden by whatever the backend derived from a more
 * specific setting, with debuginfod queries off underneath both by default.
 *
 * Both gdb and lldb-dap link elfutils' debuginfod client, which - given this
 * variable - queries a server for missing debug symbols synchronously, on
 * the very thread that reads and answers DAP requests. A CI runner (or any
 * network) with no route to the configured server, and traffic silently
 * dropped rather than refused, turns that into an indefinite hang that looks
 * identical to a protocol-level bug: the debugger keeps running, the
 * debuggee may even have already launched, but nothing more ever comes back
 * over the wire.
 *
 * The default only applies when nothing has already set this: not
 * `kdap.environment`, and not `hostEnv` either - the environment the
 * extension host itself was started with, e.g. inherited from opening VS
 * Code from a shell that already exports `DEBUGINFOD_URLS`. VS Code merges
 * whatever we return here into that same environment before spawning the
 * adapter, so a value that's absent from both is left for VS Code to fill
 * in from wherever else it might come from - which is exactly the case this
 * guards against, since neither the user's shell nor their `kdap.environment`
 * asked for it. An empty value is debuginfod-client's own convention for
 * "don't query".
 *
 * That "leave `hostEnv`'s own value alone" rule assumes it actually reaches
 * the adapter process unchanged, which isn't guaranteed - something between
 * the extension host and the adapter can still re-set it. Setting
 * `KDAB_DAP_DISABLE_DEBUGINFOD` in `hostEnv` stops this function from
 * trusting a `hostEnv` value at all, so the default is written into the
 * returned environment explicitly instead of being left for inheritance to
 * (maybe) preserve. `kdap.environment` still wins over it either way.
 */
export function buildAdapterEnvironment(
  options: SessionOptions,
  backendEnv: Readonly<Record<string, string>> | undefined,
  hostEnv: Readonly<Record<string, string | undefined>> = process.env,
): Record<string, string> {
  const forceDisabled = hostEnv[DISABLE_DEBUGINFOD_ENV_VAR] !== undefined;
  const alreadyConfigured =
    options.environment?.[DEBUGINFOD_ENV_VAR] !== undefined ||
    (!forceDisabled && hostEnv[DEBUGINFOD_ENV_VAR] !== undefined);

  return {
    ...(alreadyConfigured ? {} : { [DEBUGINFOD_ENV_VAR]: "" }),
    ...options.environment,
    ...backendEnv,
  };
}
