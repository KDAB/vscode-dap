# Changelog

## [1.1.0](https://github.com/KDAB/vscode-gdb-dap/compare/v1.0.0...v1.1.0) (2026-08-18)


### Features

* add Run/Debug with Args commands ([65d529a](https://github.com/KDAB/vscode-gdb-dap/commit/65d529a3d45169a505a79c9c93f0e2eafe9f7bab))


### Bug Fixes

* don't stop at entry when running without debugging ([eeefec9](https://github.com/KDAB/vscode-gdb-dap/commit/eeefec9b434d56113730790dff6c51797772fd98))
* split arguments the way a shell would ([b8127e5](https://github.com/KDAB/vscode-gdb-dap/commit/b8127e580705077cc294cd976afd71ed3e47dc21))

## 1.0.0 (2026-08-01)


### Bug Fixes

* Disable untrusted workspace support ([bb72f74](https://github.com/KDAB/vscode-gdb-dap/commit/bb72f746bf4f030d5955a0afc313df0fac8beecc))
* Do a gdb version check ([4f2a820](https://github.com/KDAB/vscode-gdb-dap/commit/4f2a82016a90fdd99da1780fb0d550ee4bdfb085))
* Expand `${workspaceFolder}` and a leading `~` in kdap settings ([608d0b9](https://github.com/KDAB/vscode-gdb-dap/commit/608d0b95bb60e5f5f9d63f5b016563b6bd125f55))
* expand a leading ~ in a launch config's gdbPath ([8a70343](https://github.com/KDAB/vscode-gdb-dap/commit/8a70343debec0baf77978caa298f383d1c9b7840))
* fix url of repo ([eecdfc5](https://github.com/KDAB/vscode-gdb-dap/commit/eecdfc58d198866846d61c6ceca9cb80897b2178))
* Harden Qt pretty-printer download ([1031db6](https://github.com/KDAB/vscode-gdb-dap/commit/1031db6a5b1fbe0038a0c8d17aea4fdbc7a095ac))
* improve defaults, make them match gdb's ([4472b67](https://github.com/KDAB/vscode-gdb-dap/commit/4472b67b625765bb0aeccb44d8d8437156d1088b))
* merge launch config env into the inferior's environment ([e2f05ea](https://github.com/KDAB/vscode-gdb-dap/commit/e2f05eac1a3bcc98a505cfbb94450f4c2e9392ca))
* Narrow extension activation to kdap debug sessions ([1d5c98d](https://github.com/KDAB/vscode-gdb-dap/commit/1d5c98d3d84795fb33991bfe0b188132ffe5ab8c))
* Only pass dap-log-level when logging is enabled ([8e0a4a5](https://github.com/KDAB/vscode-gdb-dap/commit/8e0a4a57f8feb760c38854939f7a51f6ba6b8baa))
* reject directories in isExecutable ([07e2dc5](https://github.com/KDAB/vscode-gdb-dap/commit/07e2dc58cb440344faf95cd23d2b3d2053b45120))
* require gdb 16.1+, and test against a runner that has it ([b2d070a](https://github.com/KDAB/vscode-gdb-dap/commit/b2d070a277de96181042ec2f163cdc368839cc8a))
* Resolve gdb via PATH ([6cf4b55](https://github.com/KDAB/vscode-gdb-dap/commit/6cf4b55f2153b3d809c73f290cbcc3237f72bf8f))
* update minimum gdb to 16.1 in a spot I missed ([0db4e5a](https://github.com/KDAB/vscode-gdb-dap/commit/0db4e5a25136672353738b503ae58363ed99c8d4))

## Changelog
