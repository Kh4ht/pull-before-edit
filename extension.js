const vscode = require('vscode');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

let typingDisposable = null;
let statusBarItem = null;
let checkInterval = null;

function activate(context) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusBarItem.text = "$(sync~spin) Checking remote...";
    statusBarItem.show();

    checkInterval = setInterval(async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return;

        const hasRemoteChanges = await checkRemoteChanges(workspaceFolder.uri.fsPath);

        if (hasRemoteChanges) {
            if (!typingDisposable) {
                blockTyping();
                statusBarItem.text = "$(warning) Remote has changes! Pull first";
                statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                statusBarItem.tooltip = "Run git pull before editing";

                vscode.window.showWarningMessage(
                    '⚠️ Remote has unpulled changes! Pull before editing.',
                    'Pull Now'
                ).then(action => {
                    if (action === 'Pull Now') {
                        vscode.commands.executeCommand('git.pull');
                    }
                });
            }
        } else {
            if (typingDisposable) {
                typingDisposable.dispose();
                typingDisposable = null;
                statusBarItem.text = "$(check) Ready to code";
                statusBarItem.backgroundColor = undefined;
                statusBarItem.tooltip = "";
            }
        }
    }, 10000);

    context.subscriptions.push({ dispose: () => clearInterval(checkInterval) });
    context.subscriptions.push(statusBarItem);
}

function blockTyping() {
    typingDisposable = vscode.workspace.onDidChangeTextDocument(event => {
        const edit = new vscode.WorkspaceEdit();
        event.contentChanges.forEach(change => {
            edit.set(event.document.uri, change.range, change.text);
        });

        vscode.workspace.applyEdit(edit).then(() => {
            vscode.window.showWarningMessage(
                '⛔ Cannot edit - remote changes available! Run git pull first.',
                'Pull Now'
            ).then(action => {
                if (action === 'Pull Now') {
                    vscode.commands.executeCommand('git.pull');
                }
            });
        });
    });
}

async function checkRemoteChanges(repoPath) {
    try {
        await execPromise('git fetch origin', { cwd: repoPath });

        const { stdout: behindCount } = await execPromise(
            'git rev-list HEAD..@{u} --count',
            { cwd: repoPath }
        );

        return parseInt(behindCount.trim()) > 0;
    } catch (error) {
        return false;
    }
}

function deactivate() {
    if (checkInterval) clearInterval(checkInterval);
    if (typingDisposable) typingDisposable.dispose();
}

module.exports = { activate, deactivate };