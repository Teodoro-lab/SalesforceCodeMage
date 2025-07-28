import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { SalesforceAPI } from '../salesforceAPI';

const TRACE_FLAGS_HTML_PATH = 'templates/traceFlags.html';

/**
 * Initialize and display the web view panel for trace flags.
 */
export async function openTraceFlagsWebViewCmd(context: vscode.ExtensionContext) {
    const extPath = context.extensionPath;
    const salesforce = SalesforceAPI.getInstance();
    const traceFlags = await salesforce.getTraceFlags();
    createTraceFlagsWebView(context, extPath, traceFlags);
}

/**
 * Create and configure the web view for displaying Salesforce trace flags.
 */
async function createTraceFlagsWebView(context: vscode.ExtensionContext, extPath: string, traceFlags: any[]) {
    const panel = createWebviewPanel();
    let htmlContent = getHtmlTemplate(extPath);
    const codiconsUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

    htmlContent = htmlContent.replace('${codiconsUri}', codiconsUri.toString());
    panel.webview.html = htmlContent;

    panel.webview.postMessage({ command: 'traceFlagsFirstLoad', traceFlags: traceFlags });

    handleWebViewMessages(panel, context);
}

/**
 * Create a web view panel.
 */
function createWebviewPanel(): vscode.WebviewPanel {
    return vscode.window.createWebviewPanel(
        'traceFlags', 'Trace Flags', vscode.ViewColumn.One, {
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
    const htmlPath = path.normalize(path.join(extPath, TRACE_FLAGS_HTML_PATH));
    return fs.readFileSync(htmlPath, 'utf-8');
}

/**
 * Handle messages received from the web view.
 */
function handleWebViewMessages(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    panel.webview.onDidReceiveMessage(
        async message => {
            switch (message.command) {
                case 'reactivateTraceFlag':
                    await reactivateTraceFlag(message.traceFlagId);
                    const traceFlagsReac = await refreshTraceFlags();
                    panel.webview.postMessage({ command: 'traceFlagReactivated', traceFlagId: message.traceFlagId, traceFlags: traceFlagsReac });
                    break;
                case 'refreshTraceFlags':
                    const traceFlags = await refreshTraceFlags();
                    panel.webview.postMessage({ command: 'traceFlagsRefreshed', traceFlags: traceFlags });
                    break;
            }
        },
        undefined,
        context.subscriptions
    );
}

/**
 * Reactivate a trace flag by updating its start and expiration dates.
 */
async function reactivateTraceFlag(traceFlagId: string) {
    try {
        const salesforce = SalesforceAPI.getInstance();
        await salesforce.reactivateTraceFlag(traceFlagId);
        const traceFlags = await refreshTraceFlags();
    } catch (error) {
        const errorMessage = (error as Error).message;
        vscode.window.showErrorMessage(`Error reactivating trace flag: ${errorMessage}`);
    }
}

/**
 * Refresh trace flags by querying Salesforce again.
 */
async function refreshTraceFlags(): Promise<any[]> {
    try {
        const salesforce = SalesforceAPI.getInstance();
        const traceFlags = await salesforce.getTraceFlags();
        return traceFlags;
    } catch (error) {
        const errorMessage = (error as Error).message;
        vscode.window.showErrorMessage(`Error refreshing trace flags: ${errorMessage}`);
        return [];
    }
}