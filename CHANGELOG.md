# Changelog

## [1.2.0](https://github.com/KDAB/vscode-gdb-dap/compare/v1.1.0...v1.2.0) (2026-08-25)


### Features

* Add an lldb-dap backend ([071817b](https://github.com/KDAB/vscode-gdb-dap/commit/071817bc75a0d98cfdf0237e396dd1c2d24c1a7f))
* add lldb Qt pretty printer for QByteArray ([a7a3c84](https://github.com/KDAB/vscode-gdb-dap/commit/a7a3c849b18d6e8406b0e0a073abbb7f26896dbf))
* add lldb Qt pretty printer for QChar ([8a022df](https://github.com/KDAB/vscode-gdb-dap/commit/8a022df0d156057d1b3fa9f2cd43b585bfec92e8))
* add lldb Qt pretty printer for QDate ([dc55836](https://github.com/KDAB/vscode-gdb-dap/commit/dc5583654e317b330ffcc633b1c976f24e0f9010))
* add lldb Qt pretty printer for QHash ([46d7f84](https://github.com/KDAB/vscode-gdb-dap/commit/46d7f8428134ad76b3179eb81061f191869074e4))
* add lldb Qt pretty printer for QLatin1String ([94dc7e3](https://github.com/KDAB/vscode-gdb-dap/commit/94dc7e340bae91ffb703ddeddc31fcc82a8007e8))
* add lldb Qt pretty printer for QMap ([229acc4](https://github.com/KDAB/vscode-gdb-dap/commit/229acc4f74cb0a13d90421aa56075dc5af5060a9))
* add lldb Qt pretty printer for QMultiHash ([dd62091](https://github.com/KDAB/vscode-gdb-dap/commit/dd62091bbbc6a155faaf8ae54497f063fc23add4))
* add lldb Qt pretty printer for QMultiMap ([24f6b12](https://github.com/KDAB/vscode-gdb-dap/commit/24f6b12966553593ea5f3673e158557c5a8b3b8b))
* add lldb Qt pretty printer for QQueue ([3e378a7](https://github.com/KDAB/vscode-gdb-dap/commit/3e378a739671e7c33d26b43923da18a775d5e2f7))
* add lldb Qt pretty printer for QSet ([57cb38e](https://github.com/KDAB/vscode-gdb-dap/commit/57cb38e0f9db820c4341d511a2e86bf13760673a))
* add lldb Qt pretty printer for QStack ([41ec324](https://github.com/KDAB/vscode-gdb-dap/commit/41ec3246920bed1294fced43df85c8bd6b008e03))
* add lldb Qt pretty printer for QString ([c6fadb2](https://github.com/KDAB/vscode-gdb-dap/commit/c6fadb2738bd664918289eb549526519eb0b4b31))
* add lldb Qt pretty printer for QStringList ([d2d1c5d](https://github.com/KDAB/vscode-gdb-dap/commit/d2d1c5d27d1e2b54ce02bc323e4cd0308c18e690))
* add lldb Qt pretty printer for QStringView ([f8b088b](https://github.com/KDAB/vscode-gdb-dap/commit/f8b088bef2e040d88eb71f5939d09e3c8447718a))
* add lldb Qt pretty printer for QTime ([eaf6606](https://github.com/KDAB/vscode-gdb-dap/commit/eaf660681aeb9f3f79d155342787b8b809610d94))
* add lldb Qt pretty printer for QUrl ([22f6679](https://github.com/KDAB/vscode-gdb-dap/commit/22f6679fdc90de3252850c851b138714d626af79))
* add lldb Qt pretty printer for QUtf8StringView ([f35d396](https://github.com/KDAB/vscode-gdb-dap/commit/f35d3967510dbaa412dc8cde3978e18c9776a0eb))
* add lldb Qt pretty printer for QUuid ([ebdf32c](https://github.com/KDAB/vscode-gdb-dap/commit/ebdf32c80e11d8b8a7b0cde6d9a8733c895af602))
* add lldb Qt pretty printer for QVector, and fix None-return bug in existing printers ([3892a80](https://github.com/KDAB/vscode-gdb-dap/commit/3892a80b604ba720c749805c2ee61d155791cffd))
* add lldb Qt pretty printers for QPointF, QSize, QSizeF, QRect, QRectF, QLine and QLineF ([f1e89b2](https://github.com/KDAB/vscode-gdb-dap/commit/f1e89b286e479e9b942a59d134978120a9e1f570))
* Add Load Core File command ([3f6f1e7](https://github.com/KDAB/vscode-gdb-dap/commit/3f6f1e71eab1afeeb9899208b26d04710c1a3a54))
* Add skipGdbinit launch config option ([f944fbe](https://github.com/KDAB/vscode-gdb-dap/commit/f944fbed97c3487e90e5e8c72fee59d62260e0b8))
* Add sourceFileMap launch config option ([eea89b0](https://github.com/KDAB/vscode-gdb-dap/commit/eea89b01bfe7fc67d9bf206790c30e398af7e8db))
* add standalone Qt pretty printers for lldb, starting with QPoint ([cacac2e](https://github.com/KDAB/vscode-gdb-dap/commit/cacac2ece729389efad7faba6beec034ef27d588))
* add standalone Qt pretty printers for lldb, starting with QPoint ([23953db](https://github.com/KDAB/vscode-gdb-dap/commit/23953dba05ce302119c5933fbd75c9da217c251b))
* Add sysroot property to launch config ([07c4898](https://github.com/KDAB/vscode-gdb-dap/commit/07c4898a82148c6440013d6a7c45f73ad43a8b01))
* Declare lldb-dap's own launch configuration properties ([690c377](https://github.com/KDAB/vscode-gdb-dap/commit/690c377babb809ba2c26db5402d938a2e187e809))
* Make qtPrettyPrinters per launch not global ([b01a257](https://github.com/KDAB/vscode-gdb-dap/commit/b01a257564b6c642d0db00324de207cab3441bf9))
* register QVector's lldb printer for QList too ([8443f42](https://github.com/KDAB/vscode-gdb-dap/commit/8443f425743a51a62e218dbbccf02bdb811fbe70))
* Support pretty-printers for LLDB ([78a37c3](https://github.com/KDAB/vscode-gdb-dap/commit/78a37c320e58e3d90dc8219e2c48b9e81a137726))


### Bug Fixes

* count map-hinted children by pairing, not by halving num_children ([f0be5fd](https://github.com/KDAB/vscode-gdb-dap/commit/f0be5fdabcf81fccd60d7e79ab8554e55f33d25e))
* Disable debuginfod by default for both debuggers ([e91096d](https://github.com/KDAB/vscode-gdb-dap/commit/e91096d4bce6c5913cf07ce5048f7b9d2e403545))
* don't let an unreadable QUrl component silently vanish ([4eced22](https://github.com/KDAB/vscode-gdb-dap/commit/4eced22733e70b4e5fabc7fdeb191f1bbc48afa8))
* Fix gdb displaying maps ([35bd118](https://github.com/KDAB/vscode-gdb-dap/commit/35bd118ae21492bea5021d82e8b15f3c7c057ca4))
* handle gdb 17's VariableReference attribute rename ([f7046e0](https://github.com/KDAB/vscode-gdb-dap/commit/f7046e0725b9022a04cc36c1da3339a0ccfb8866))
* print an empty QUrl instead of dumping its raw pointer ([985b317](https://github.com/KDAB/vscode-gdb-dap/commit/985b31752eadc7c15c79b111f34b52a4b1d630a9))
* Read gdb's version from the last field of its --version line ([d06e050](https://github.com/KDAB/vscode-gdb-dap/commit/d06e05052c0915e4d298e2156b9fff6ccde65fef))
* treat every out-of-range QTime as invalid, not just -1 ([f59055c](https://github.com/KDAB/vscode-gdb-dap/commit/f59055c16fd322293a4c113f90778ee9788c40ce))

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
