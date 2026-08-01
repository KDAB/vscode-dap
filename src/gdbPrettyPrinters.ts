// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as fs from "node:fs/promises";
import * as https from "node:https";
import * as path from "path";
import * as vscode from "vscode";

const GDB_QT_PRINTERS_BASE_URL =
  "https://raw.githubusercontent.com/iamsergio/kdevelop/vscode-gdb-dap/plugins/gdb/printers";

const DOWNLOAD_TIMEOUT_MS = 10_000;

/** Downloads the contents of a URL, following redirects. */
function downloadFile(url: string, redirectsLeft = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https
      .get(url, { timeout: DOWNLOAD_TIMEOUT_MS }, (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          if (redirectsLeft <= 0) {
            reject(new Error("Too many redirects while downloading " + url));
            return;
          }
          resolve(downloadFile(res.headers.location, redirectsLeft - 1));
          return;
        }

        if (status < 200 || status >= 300) {
          reject(
            new Error("Failed to download " + url + ": HTTP status " + status),
          );
          return;
        }

        res.setEncoding("utf8");
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);

    req.on("timeout", () => {
      req.destroy(new Error("Timed out downloading " + url));
    });
  });
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export function getPrettyPrintersDir(context: vscode.ExtensionContext): string {
  return path.join(context.globalStorageUri.fsPath, "pretty-printers");
}

/**
 * Downloads the KDevelop Qt gdb pretty-printer scripts into this extension's
 * global storage directory. Independent of ~/.config/gdb - nothing in the
 * user's gdbinit is read or written.
 */
export async function downloadQtPrettyPrinters(
  context: vscode.ExtensionContext,
): Promise<void> {
  const dir = getPrettyPrintersDir(context);
  const qtCreatorDebuggerDir = path.join(dir, "qtcreator_debugger");

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Downloading Qt gdb pretty printers",
      },
      async () => {
        await fs.mkdir(qtCreatorDebuggerDir, { recursive: true });

        // qt.py's presence is used as the "is it installed?" sentinel (see
        // getQtPrettyPrintersArgs), and it imports qtcreator_debugger at
        // module scope. Download and write everything else first, and write
        // qt.py last, so a failure partway through never leaves qt.py
        // pointing at a broken install.
        const helperContents = await downloadFile(
          GDB_QT_PRINTERS_BASE_URL + "/helper.py",
        );
        const qtContents = await downloadFile(
          GDB_QT_PRINTERS_BASE_URL + "/qt.py",
        );

        for (const filename of [
          "__init__.py",
          "dumper.py",
          "gdbbridge.py",
          "qttypes.py",
        ]) {
          const contents = await downloadFile(
            GDB_QT_PRINTERS_BASE_URL + "/qtcreator_debugger/" + filename,
          );
          await fs.writeFile(
            path.join(qtCreatorDebuggerDir, filename),
            contents,
          );
        }

        await fs.writeFile(path.join(dir, "helper.py"), helperContents);
        await fs.writeFile(path.join(dir, "qt.py"), qtContents);
      },
    );

    // Fire and forget: awaiting would block until the user dismisses it.
    void vscode.window.showInformationMessage(
      "Qt gdb pretty printers downloaded to " + dir,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    void vscode.window.showErrorMessage(
      "Failed to download Qt gdb pretty printers: " + message,
    );
  }
}

/**
 * Returns the gdb args needed to load the Qt pretty-printers, or an empty
 * array if they haven't been downloaded yet (see downloadQtPrettyPrinters).
 */
export async function getQtPrettyPrintersArgs(
  context: vscode.ExtensionContext,
): Promise<string[]> {
  const dir = getPrettyPrintersDir(context);
  if (!(await pathExists(path.join(dir, "qt.py")))) {
    return [];
  }

  return [
    "-iex",
    `python import sys; sys.path.insert(0, ${JSON.stringify(dir)}); from qt import register_qt_printers; register_qt_printers(None)`,
  ];
}
