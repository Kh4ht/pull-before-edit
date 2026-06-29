const vscode = require('vscode');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

let typingDisposable = null;
let statusBarItem = null;
let checkInterval = null;
let warningShown = false;

const INTERVAL_NORMAL = 60000;  // 1 min
const INTERVAL_URGENT = 10000;  // 10 sec

// region scheduleCheck

function scheduleCheck(interval) {
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(runCheck, interval);
}

// region runCheck

async function runCheck() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    statusBarItem.text = "$(sync~spin) Checking remote...";
    const hasRemoteChanges = await checkRemoteChanges(workspaceFolder.uri.fsPath);

    if (hasRemoteChanges) {
        scheduleCheck(INTERVAL_URGENT);

        if (!typingDisposable) {
            blockTyping();
            statusBarItem.text = "$(warning) Remote has changes! Pull first";
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            statusBarItem.tooltip = "Run git pull before editing";

            if (!warningShown) {
                warningShown = true;
                vscode.window.showWarningMessage(
                    '⚠️ Remote has unpulled changes! Pull before editing.',
                    'Pull Now'
                ).then(async action => {
                    if (action === 'Pull Now') {
                        await vscode.commands.executeCommand('git.pull');
                        await runCheck();
                    }
                });
            }
        }
    } else {
        scheduleCheck(INTERVAL_NORMAL);

        warningShown = false;
        if (typingDisposable) {
            typingDisposable.dispose();
            typingDisposable = null;
        }
        statusBarItem.text = "$(check) Ready to code";
        statusBarItem.backgroundColor = undefined;
        statusBarItem.tooltip = "";
    }
}

// region activate

function activate(context) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusBarItem.text = "$(sync~spin) Checking remote...";
    statusBarItem.show();

    runCheck();
    scheduleCheck(INTERVAL_NORMAL);

    context.subscriptions.push({ dispose: () => clearInterval(checkInterval) });
    context.subscriptions.push(statusBarItem);
}

// region blockTyping

function blockTyping() {
    typingDisposable = vscode.workspace.onDidChangeTextDocument(async event => {
        if (event.document.uri.scheme !== 'file') return;

        // Don't spam — only show if not already showing
        if (warningShown) return;

        warningShown = true;
        vscode.window.showWarningMessage(
            '⛔ Remote has unpulled changes! Pull before editing.',
            'Pull Now'
        ).then(async action => {
            warningShown = false;  // reset so it can show again if needed
            if (action === 'Pull Now') {
                await vscode.commands.executeCommand('git.pull');
                await runCheck();
            }
        });
    });
}

// region checkRemoteChanges

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

// region deactivate

function deactivate() {
    if (checkInterval) clearInterval(checkInterval);
    if (typingDisposable) typingDisposable.dispose();
}

module.exports = { activate, deactivate };