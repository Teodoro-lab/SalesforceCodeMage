import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { SalesforceAPI } from '../SalesforceAPI';
import { LogAnalyzer } from './LogAnalyzer';

/**
 * Initialize and display the web view panel for debugging logs.
 */
export async function openLogsWebViewCmd(context: vscode.ExtensionContext) {
    const extPath = context.extensionPath;
    const salesforce = SalesforceAPI.getInstance();
    const logs = await salesforce.debugLogsList();
    createLogsWebView(context, extPath, logs);
}

/**
 * Create and configure the web view for displaying Salesforce debug logs.
 */
async function createLogsWebView(context: vscode.ExtensionContext, extPath: string, logs: any[]) {
    const panel = createWebviewPanel();
    let htmlContent = getHtmlTemplate(extPath);
    const codiconsUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

    htmlContent = htmlContent.replace('${codiconsUri}', codiconsUri.toString());
    panel.webview.html = htmlContent;

    loadLogsCacheForAnalysis(logs);
    panel.webview.postMessage({ command: 'logsFirstLoad', logs: logs });

    handleWebViewMessages(panel, context);
}

/**
 * Create a web view panel.
 */
function createWebviewPanel(): vscode.WebviewPanel {
    return vscode.window.createWebviewPanel(
        'logs', 'Debug Logs', vscode.ViewColumn.One, {
            enableScripts: true,
            enableCommandUris: true,
            retainContextWhenHidden: true,
            enableFindWidget: true,
            
        }
    );
}

/**
 * Read and return the HTML template content.
 */
function getHtmlTemplate(extPath: string): string {
    const htmlPath = path.normalize(path.join(extPath, 'webviewTemplates/debugLogsWebView.html'));
    return fs.readFileSync(htmlPath, 'utf-8');
}

/**
 * Handle messages received from the web view.
 */
function handleWebViewMessages(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    panel.webview.onDidReceiveMessage(
        message => {
            switch (message.command) {
                case 'downloadLogs':
                    retrieveLogsFor(message, panel);
                    break;
                case 'reloadLogs':
                    reloadLogs(panel);
                    break;
                case 'openLog':
                    openLogFile(message.logId);
                    break;
            }
        },
        undefined,
        context.subscriptions
    );
}

/**
 * Reload logs and update the web view.
 */
function reloadLogs(panel: vscode.WebviewPanel) {
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Loading",
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 0 });
        const salesforce = SalesforceAPI.getInstance();
        let logs = await salesforce.debugLogsList();
        loadLogsCacheForAnalysis(logs);
        sendNewLogs(logs, panel);
        progress.report({ increment: 100 });
    });
}

async function sendNewLogs(logs: any[], panel: vscode.WebviewPanel) {
    panel.webview.postMessage({ command: 'logsFirstLoad', logs: logs });
}

/**
 * Open a log file in the editor.
 */
function openLogFile(logId: string) {
    const whereToSaveLogs = getLogsDirectory();
    const filePath = path.join(whereToSaveLogs, `${logId}.log`);
    vscode.workspace.openTextDocument(filePath).then(doc => {
        vscode.window.showTextDocument(doc);
    });
}

/**
 * Retrieve logs based on provided message details.
 */
async function retrieveLogsFor(message: any, panel: vscode.WebviewPanel) {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Retrieving logs...",
        cancellable: false
    }, async (progress) => {
        let logIds = message.logIds;
        const whereToSaveLogs = getLogsDirectory();
        const totalLogs = logIds.length;
        let processedLogs = 0;

        ensureDirectoryExists(whereToSaveLogs);

        for (let logId of logIds) {
            const filePath = path.join(whereToSaveLogs, `${logId}.log`);
            await processLog(logId, filePath, panel);
            processedLogs++;
            progress.report({ increment: (processedLogs / totalLogs) * 100 });
        }
    });
}

/**
 * Ensure that the specified directory exists.
 */
function ensureDirectoryExists(directory: string) {
    if (!fs.existsSync(directory)) {
        console.log("Directory doesn't exist. Creating...");
        fs.mkdirSync(directory);
    }
}

/**
 * Get the directory to save logs.
 */
function getLogsDirectory() {
    return vscode.workspace.workspaceFolders
        ? path.normalize(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'debug-logs'))
        : '';
}

/**
 * Process each log file, retrieve if not present, and analyze.
 */
async function processLog(logId: string, filePath: string, panel: vscode.WebviewPanel) {
    if (fs.existsSync(filePath)) {
        const logContent = fs.readFileSync(filePath, 'utf8');
        postLogLoadedMessage(logId, logContent, panel);
    } else {
        await fetchAndSaveLog(logId, filePath, panel);
    }
}

/**
 * Post a message when a log is loaded.
 */
function postLogLoadedMessage(logId: string, logContent: string, panel: vscode.WebviewPanel) {
    let logAnalyzer = new LogAnalyzer();
    let logAnalysis = logAnalyzer.analyzeDebugLog(logId, logContent);
    panel.webview.postMessage({ command: 'logLoaded', logId: logId, status: 'success', analysis: logAnalysis });
}

/**
 * Fetch a log from Salesforce, save it, and post a success message.
 */
async function fetchAndSaveLog(logId: string, filePath: string, panel: vscode.WebviewPanel) {
    try {
        const salesforce = SalesforceAPI.getInstance();
        let logJson = await salesforce.debugLog(logId);
        let logContent = logJson.log;
        if (logContent) {
            fs.writeFileSync(filePath, logContent, 'utf8');
            postLogLoadedMessage(logId, logContent, panel);
        } else {
            vscode.window.showErrorMessage(`Failed to retrieve log ${logId}`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to retrieve or save log ${logId}: ${error}`);
    }
}

function loadLogsCacheForAnalysis(logs: any[]): void {

    logs.forEach(log => {
        const logId = log.Id;
        const logAnalyzer = new LogAnalyzer();

        // no need to pass content since it might be already cached the result of the analysis
        let existsLog = fs.existsSync(path.join(getLogsDirectory(), `${logId}.log`));

        
        let analysis = logAnalyzer.analyzeDebugLog(logId, ''); 
        if (analysis && analysis.operationName !== 'Unknown Operation' && existsLog) {
            log.Type = analysis.operationName;
            log.Loaded = '✅';
        } else if (existsLog && analysis && analysis.operationName === 'Unknown Operation') {
            log.Type = 'Loaded but not supported operation';
            log.Loaded = '⚠️';
        } else if (!existsLog && analysis && analysis.operationName){
            log.Type = 'Analyzed but not loaded';
            log.Loaded = '🔍';
        } else if (!existsLog && !analysis){
            log.Type = 'Not analyzed';
            log.Loaded = '⛔';
        }
    });
}

export async function deleteDebugLogsCmd() {
    vscode.window.showInformationMessage('Deleting logs...');
    const whereToSaveLogs = getLogsDirectory();
    const logs = fs.readdirSync(whereToSaveLogs);
    if (logs.length === 0) {
        vscode.window.showInformationMessage('No logs to delete');
        return;
    } 
    logs.forEach(log => {
        fs.unlinkSync(path.join(whereToSaveLogs, log));
    });
    vscode.window.showInformationMessage('Logs deleted');
}
