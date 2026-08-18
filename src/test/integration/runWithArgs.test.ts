// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as assert from "assert";

import { splitArguments } from "../../runWithArgs";

suite("splitArguments", () => {
  const cases: [string, string[]][] = [
    // Nothing to split.
    ["", []],
    ["   ", []],
    ["\t\n ", []],

    // Bare words.
    ["a", ["a"]],
    ["a b", ["a", "b"]],
    ["   a   b   ", ["a", "b"]],
    ["a\tb\nc", ["a", "b", "c"]],
    ["--foo bar", ["--foo", "bar"]],

    // Whole-argument quoting.
    ['"quoted value"', ["quoted value"]],
    ["'quoted value'", ["quoted value"]],
    ['--foo bar "quoted value"', ["--foo", "bar", "quoted value"]],
    ['"a  b"', ["a  b"]],
    ['" a "', [" a "]],
    ['"a b" "c d"', ["a b", "c d"]],

    // Quotes opening and closing mid-argument, and concatenation.
    ['--name="two words"', ["--name=two words"]],
    ["--name='two words'", ["--name=two words"]],
    ['a"b c"d', ["ab cd"]],
    ["\"a\"'b'c", ["abc"]],
    ['"a""b"', ["ab"]],

    // Empty arguments survive.
    ['""', [""]],
    ["''", [""]],
    ['a "" b', ["a", "", "b"]],
    ['"" ""', ["", ""]],
    ['a"" b', ["a", "b"]],

    // Escapes inside double quotes: only " and \ are escaped.
    ['"say \\"hi\\""', ['say "hi"']],
    ['"back\\\\slash"', ["back\\slash"]],
    ['"\\d+"', ["\\d+"]],
    ['"\\n"', ["\\n"]],
    ['"a\\" b"', ['a" b']],

    // Single quotes are literal throughout.
    ["'a\\b'", ["a\\b"]],
    ["'\\'", ["\\"]],
    ["'\"'", ['"']],
    ['"\'"', ["'"]],

    // Escapes outside quotes apply to any character.
    ["a\\ b", ["a b"]],
    ["/path/a\\ b", ["/path/a b"]],
    ['\\"a', ['"a']],
    ["\\'a", ["'a"]],
    ["a\\\\b", ["a\\b"]],
    ["\\a", ["a"]],

    // A trailing backslash has nothing to escape, so it stays literal.
    ["a\\", ["a\\"]],
    ["\\", ["\\"]],
  ];

  for (const [input, expected] of cases) {
    test(`splits ${JSON.stringify(input)}`, () => {
      assert.deepStrictEqual(splitArguments(input), expected);
    });
  }

  const unterminated = [
    '"',
    "'",
    '"a',
    "'a",
    'a "b c',
    "a 'b c",
    // The closing quote is escaped, so the argument is still open.
    '"a\\"',
    // An escaped quote outside quotes does not open one, so this closes here.
    '\\""',
  ];

  for (const input of unterminated) {
    test(`rejects unterminated quote in ${JSON.stringify(input)}`, () => {
      assert.throws(
        () => splitArguments(input),
        /Unterminated (double|single) quote/,
      );
    });
  }
});
