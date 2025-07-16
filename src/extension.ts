import * as path from 'path';
import * as vscode from 'vscode';
import { findWorkspaceTargetOrg } from './salesforceUtils';

import { SalesforceAPI } from './SalesforceAPI';
import { setupHoverApexProvider } from './apexHoverProvider';
import { clearCache } from './cache';
import { openLogsWebViewCmd, deleteDebugLogsCmd } from './logHandling/LogsCommands';
import { createSObjTableWebView, showSObjTable } from './sObjectsTables/sObjectsHandling';
import { LWCExplorerProvider } from './LWCExplorerProvider';
import { openTraceFlagsWebViewCmd } from './sfTraceFlags/traceflags';

export async function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('magicSF is getting activated!');
    
    const salesforce = SalesforceAPI.getInstance();
    

    vscode.window.showInformationMessage('magicSF is activated!');
    const orgs = await SalesforceAPI.getOrgsInfo();

    let targetOrg: string;
    try {
        targetOrg = findWorkspaceTargetOrg();
    } catch (error: any) {
        vscode.window.showInformationMessage('Error in getting target org details. Please check the config file: ' + error.message);
        return;
    }
    
    const username = orgs.find((org: any) => org.alias === targetOrg).username;
    const connection = await salesforce.connect(username);

    const testCon = await SalesforceAPI.getConnection(username);
    vscode.window.showInformationMessage('Conn url: ' + testCon.tooling.autoFetchQuery('SELECT Name from Account'));
    
    console.log('GETTING TRACE FLAGS');
    
    salesforce.getTraceFlags();


    const activateApexHover = vscode.workspace.getConfiguration('magicSF').get('activateApexHover');
    if (activateApexHover) {setupHoverApexProvider();}
    
    vscode.commands.registerCommand('magicSF.clearCache', clearCacheCmd);
    vscode.commands.registerCommand('magicSF.OpenFlowInOrg', openFlowInOrgCmd);
    vscode.commands.registerCommand('magicSF.openDeveloperConsole', () => {openDeveloperConsoleCmd(targetOrg);});
    vscode.commands.registerCommand('magicSF.sObjectTable', (args) => {sObjectTableCmd(args, context);});
    vscode.commands.registerCommand('magicSF.ShowSObjTable', () => {showObjectTableInputCmd(context);});
    vscode.commands.registerCommand('magicSF.ShowSObjTableWithSelectedText', () => {showObjectTableSelectedTxtCmd(context);});
    vscode.commands.registerCommand('magicSF.openDebugLogs', () => {openLogsWebViewCmd(context);});
    vscode.commands.registerCommand('magicSF.deleteDebugLogs', deleteDebugLogsCmd);

    const lwcExplorerProvider = new LWCExplorerProvider();
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

    // Check configuration and close the previously active editor if enabled
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
async function sObjectTableCmd(args: any, context: vscode.ExtensionContext) {
    const { sObjectName } = args;
    const extPath = context.extensionPath;
    const salesforce = SalesforceAPI.getInstance();
    const fields = await salesforce.fieldsOf(sObjectName);
    createSObjTableWebView(extPath, fields, sObjectName);
}

async function showObjectTableSelectedTxtCmd(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('Getting details for the selected sObject...');
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        const salesforce = SalesforceAPI.getInstance();
        const fields = await salesforce.fieldsOf(selectedText);
        showSObjTable(context, selectedText, fields);
    }
}

async function showObjectTableInputCmd(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('Getting details for the sObject...');
    const sObjectName : string = await vscode.window.showInputBox({
        placeHolder: 'Enter the sObject name to get the details',
    }) || '';
    const salesforce = SalesforceAPI.getInstance();
    const fields = await salesforce.fieldsOf(sObjectName);
    showSObjTable(context, sObjectName, fields);
}

