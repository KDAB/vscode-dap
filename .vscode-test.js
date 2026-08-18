const { defineConfig } = require("@vscode/test-cli");

module.exports = defineConfig([
  {
    files: "out/test/integration/smoke.test.js",
    mocha: {
      timeout: 20000,
      ui: "tdd",
    },
  },
  {
    files: "out/test/integration/debug.test.js",
    mocha: {
      timeout: 60000,
      ui: "tdd",
    },
  },
]);
