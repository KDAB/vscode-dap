# Tips for contributors

## Build

```
npm install
vsce package
code --install-extension gdb-dap-*.vsix
```

## Automatic tests

Run `./test.sh`. Requires GDB 16.1+ and gcc on `PATH` (the tests compile a small C fixture and
debug it end-to-end). `./test.sh --unit` runs just the unit tests, which need neither.

## Commit

We use conventional commits. Prefix your commit message with `fix: `, `feat: `, `chore: `,
`ci: `, `test: `, `refactor: ` or `docs: ` depending on the nature of the change (enforced by
the pre-commit hook). This will be used for automatic changelog generation.

## Releasing

Changelog, version bump and tagging is done automatically by merging the release PR. See the
[workflow](.github/workflows/release-please.yml).

- Optional: run `npm update` to update packages in package-lock.json. Not needed for every release.
- Optional: `npm outdated` and maybe bump more packages in package.json. Not needed for every release.
- Run `vsce ls` and see if unneeded junk isn't being packaged
- Merge the Release PR if CI is green (you'll need to close and reopen it to trigger CI!)

## Publishing

Packaging is done automatically by the [package.yml](.github/workflows/package.yml) workflow, which
uploads a package to the GitHub releases page.

If for some reason there's no `*.vsix` file under `assets`, you can trigger the workflow manually
under the Actions tab.

After packaging is done, go to https://marketplace.visualstudio.com/manage/publishers/KDAB and
upload the `*.vsix` file.
