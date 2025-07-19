import * as path from 'path';
import * as vscode from 'vscode';
import { findWorkspaceTargetOrg } from './salesforceUtils';

import { SalesforceAPI } from './salesforceAPI';
import { setupHoverApexProvider } from './hoverProvider';
import { clearCache } from './cache';
import { openLogsWebViewCmd, deleteDebugLogsCmd } from './logHandling/logsCommands';
import { showSObjTable } from './objectTables/sObjectTable';
import { createSObjTableWebView } from './objectTables/sObjectTable';
import { LwcExplorerProvider } from './lwcExplorerProvider';
import { openTraceFlagsWebViewCmd } from './traceFlags/traceFlags';

export async function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('magicSF is getting activated!');
    
    const salesforce = SalesforceAPI.getInstance();
    const orgs = await SalesforceAPI.getOrgsInfo();

    let targetOrg: string;
    try {
        targetOrg = findWorkspaceTargetOrg();
    } catch (error: any) {
        vscode.window.showInformationMessage('Error in getting target org details. Please check the config file: ' + error.message);
        return;
    }
    
    const username = orgs.find((org: any) => org.alias === targetOrg).username;
    await salesforce.connect(username);

    setupHoverApexProvider();
    vscode.commands.registerCommand('magicSF.clearCache', clearCacheCmd);
    vscode.commands.registerCommand('magicSF.OpenFlowInOrg', openFlowInOrgCmd);
    vscode.commands.registerCommand('magicSF.openDeveloperConsole', () => {openDeveloperConsoleCmd(targetOrg);});
    vscode.commands.registerCommand('magicSF.sObjectTable', (args) => {sObjectTableCmd(args, context, targetOrg);});
    vscode.commands.registerCommand('magicSF.ShowSObjTable', () => {objectTable_InputCommand(context, targetOrg);});
    vscode.commands.registerCommand('magicSF.ShowSObjTableWithSelectedText', () => {objectTable_SelectedTextCommand(context, targetOrg);});
    vscode.commands.registerCommand('magicSF.openDebugLogs', () => {openLogsWebViewCmd(context);});
    vscode.commands.registerCommand('magicSF.deleteDebugLogs', deleteDebugLogsCmd);

    const lwcExplorerProvider = new LwcExplorerProvider();
    vscode.window.registerTreeDataProvider('lwcExplorer', lwcExplorerProvider);
    vscode.commands.registerCommand('magicSF.refresh', () => lwcExplorerProvider.refresh());

    vscode.commands.registerCommand('magicSF.showTraceFlags', async () => {
        await openTraceFlagsWebViewCmd(context);
    });

    vscode.commands.registerCommand('lwcExplorer.openFile', (resourceUri: vscode.Uri) => {switchLwcTabsCmd(resourceUri);});
}

async function switchLwcTabsCmd(resourceUri: vscode.Uri) {
    const previousEditor = vscode.window.activeTextEditor;
    await vscode.commands.executeCommand('vscode.open', resourceUri);
    const closePreviousEditor = vscode.workspace.getConfiguration('magicSF').get('closePreviousEditorOnOpen', false);
    if (closePreviousEditor && previousEditor && previousEditor.document.uri.toString() !== resourceUri.toString()) {
        await closeEditor(previousEditor);
    }
}

async function closeEditor(editor: vscode.TextEditor) {
    const allGroups = vscode.window.tabGroups.all;
    for (const group of allGroups) {
        const tab = group.tabs.find(tab => tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === editor.document.uri.toString());
        if (tab) {
            await vscode.window.tabGroups.close(tab, false);
            break;
        }
    }
}

async function clearCacheCmd() {
    vscode.window.showInformationMessage('Clearing cache...');
    clearCache();
}

async function openFlowInOrgCmd(uri: vscode.Uri) {
    vscode.window.showInformationMessage('Opening flow in org...');
    if (!uri) {
        vscode.window.showErrorMessage('No file selected');
        return;
    }
    const filePath = path.normalize(uri.fsPath);
    vscode.window.showInformationMessage(`Selected file: ${filePath}`);
    SalesforceAPI.openFlowInOrg(filePath);
}

async function openDeveloperConsoleCmd(targetOrg: any) {
    vscode.window.showInformationMessage('Opening Developer Console...');
    const salesforce = SalesforceAPI.getInstance();
    const org = await salesforce.orgDetails(targetOrg);
    const instanceUrl = org.instanceUrl;
    const url = `${instanceUrl}/_ui/common/apex/debug/ApexCSIPage`;
    vscode.env.openExternal(vscode.Uri.parse(url));
}

/**
 * Command to show the sObject table in a webview. This is called when the user clicks on the 'View Detailed Information' link in the hover.
 * @param args any
 * @param context vscode.ExtensionContext
 * @param connection jsforce.Connection
 **/
async function sObjectTableCmd(args: any, context: vscode.ExtensionContext, targetOrg: string) {
    const { sObjectName } = args;
    const extPath = context.extensionPath;
    const salesforce = SalesforceAPI.getInstance();
    const fields = await salesforce.fieldsOf(sObjectName);
    const org = await salesforce.orgDetails(targetOrg);
    const instanceUrl = org.instanceUrl;
    
    createSObjTableWebView(extPath, fields, sObjectName, instanceUrl, context);
}

async function objectTable_SelectedTextCommand(context: vscode.ExtensionContext, targetOrg: string) {
    vscode.window.showInformationMessage('Getting details for the selected sObject...');
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        const salesforce = SalesforceAPI.getInstance();
        const fields = await salesforce.fieldsOf(selectedText);
        const org = await salesforce.orgDetails(targetOrg);
        const instanceUrl = org.instanceUrl;
        showSObjTable(context, selectedText, fields, instanceUrl);
    }
}

async function objectTable_InputCommand(context: vscode.ExtensionContext, targetOrg: string) {
    vscode.window.showInformationMessage('Getting details for the sObject...');
    // Prompt for input, then show quick pick for suggestions
    const input = await vscode.window.showInputBox({
        placeHolder: 'Type at least 2 characters of the sObject name or API name',
    });
    if (!input || input.length < 2) {
        vscode.window.showErrorMessage('Please enter at least 2 characters.');
        return;
    }
    const salesforce = SalesforceAPI.getInstance();
    // Fetch all sObject names matching the input (limit to 20)
    let sObjects: Array<{ label: string; description: string; value: string }> = [];
    try {
        const allObjects = await salesforce.sObjectsMatchingName(input, 20);
        sObjects = allObjects.map((obj: any) => ({
            label: obj.label || obj.name,
            description: obj.name,
            value: obj.name
        }));
    } catch (err: any) {
        vscode.window.showErrorMessage('Error fetching sObject list: ' + (err && err.message ? err.message : String(err)));
        return;
    }
    if (sObjects.length === 0) {
        vscode.window.showErrorMessage('No matching sObjects found.');
        return;
    }
    const picked = await vscode.window.showQuickPick(sObjects, {
        placeHolder: 'Select an sObject',
        matchOnDescription: true,
    });
    if (!picked) { return; }
    const sObjectName = picked.value;
    const fields = await salesforce.fieldsOf(sObjectName);
    const org = await salesforce.orgDetails(targetOrg);
    const instanceUrl = org.instanceUrl;
    showSObjTable(context, sObjectName, fields, instanceUrl);
}

