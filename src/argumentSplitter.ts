// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

// Deliberately free of any `vscode` import, so that its tests can run under
// plain mocha instead of needing a VS Code instance.

/**
 * Splits a string into arguments the way a POSIX shell would, minus any
 * expansion: whitespace separates arguments, quotes may open and close
 * anywhere within one, and adjacent segments concatenate - `--name="two
 * words"` is a single argument.
 *
 * Outside quotes, a backslash escapes the character after it; a trailing one
 * is literal. Inside double quotes it escapes only `"` and `\`, and is
 * literal otherwise, so `"\d+"` keeps its backslash. Single quotes take their
 * contents literally, backslashes included.
 *
 * Throws if the input ends inside a quoted segment.
 */
export function splitArguments(input: string): string[] {
  const args: string[] = [];
  let current = "";
  // Tracked separately from `current`, so that `""` yields an empty argument
  // rather than nothing at all.
  let started = false;
  let quote: '"' | "'" | undefined;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (quote === "'") {
      if (char === "'") {
        quote = undefined;
      } else {
        current += char;
      }
    } else if (quote === '"') {
      if (char === '"') {
        quote = undefined;
      } else if (
        char === "\\" &&
        (input[i + 1] === '"' || input[i + 1] === "\\")
      ) {
        current += input[++i];
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (char === "\\" && i + 1 < input.length) {
      current += input[++i];
      started = true;
    } else if (/\s/.test(char)) {
      if (started) {
        args.push(current);
        current = "";
        started = false;
      }
    } else {
      current += char;
      started = true;
    }
  }

  if (quote !== undefined) {
    throw new Error(
      `Unterminated ${quote === '"' ? "double" : "single"} quote in arguments.`,
    );
  }
  if (started) {
    args.push(current);
  }
  return args;
}
