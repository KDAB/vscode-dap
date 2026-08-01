import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: ["out/**", "dist/**", "**/*.d.ts", ".vscode-test/**", "node_modules/**"]
    },
    js.configs.recommended,
    // Type-aware rules, so checks like no-floating-promises actually run.
    tseslint.configs.recommendedTypeChecked,
    {
        files: ["src/**/*.ts"],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: "module",
                // tsconfig.json excludes src/test, so use the test one: it
                // covers every file under src.
                project: ["./tsconfig.test.json"],
                tsconfigRootDir: import.meta.dirname
            }
        },
        rules: {
            "@typescript-eslint/naming-convention": "off",
            // The vscode API returns Thenables rather than Promises, and those
            // are not checked by default.
            "@typescript-eslint/no-floating-promises": [
                "error",
                { checkThenables: true }
            ],
            "curly": "warn",
            "eqeqeq": "warn",
            "no-throw-literal": "warn",
            "semi": "warn"
        }
    }
);
