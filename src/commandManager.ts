import * as path from 'path';
import * as vscode from 'vscode';
import { SalesforceAPI } from './salesforceAPI';
import { clearCache } from './cache';
import { openLogsWebViewCmd, deleteDebugLogsCmd } from './debugLogsSf/debugLogs';
import { createObjectTable } from './objectTables/objectTable';
import { openTraceFlagsWebViewCmd } from './traceFlags/traceFlags';

export class CommandManager {
    private salesforce: SalesforceAPI;
    
    constructor(
        private context: vscode.ExtensionContext,
        private targetOrg: string
    ) {
        this.salesforce = SalesforceAPI.getInstance();
        
        this.clearCache = this.clearCache.bind(this);
        this.openFlowInOrg = this.openFlowInOrg.bind(this);
        this.openDeveloperConsole = this.openDeveloperConsole.bind(this);
        this.sObjectTable = this.sObjectTable.bind(this);
        this.showObjectTableFromInput = this.showObjectTableFromInput.bind(this);
        this.showObjectTableFromSelection = this.showObjectTableFromSelection.bind(this);
        this.openDebugLogs = this.openDebugLogs.bind(this);
        this.deleteDebugLogs = this.deleteDebugLogs.bind(this);
        this.showTraceFlags = this.showTraceFlags.bind(this);
        this.openLwcFile = this.openLwcFile.bind(this);
        this.refreshOrgConnection = this.refreshOrgConnection.bind(this);
    }

    async clearCache() {
        vscode.window.showInformationMessage('Clearing cache...');
        clearCache();
    }

    async openFlowInOrg(uri: vscode.Uri) {
        vscode.window.showInformationMessage('Opening flow in org...');
        
        if (!uri) {
            vscode.window.showErrorMessage('No file selected');
            return;
        }
        
        const filePath = path.normalize(uri.fsPath);
        vscode.window.showInformationMessage(`Selected file: ${filePath}`);
        SalesforceAPI.openFlowInOrg(filePath);
    }

    async openDeveloperConsole() {
        vscode.window.showInformationMessage('Opening Developer Console...');
        
        const org = await this.salesforce.orgDetails(this.targetOrg);
        const url = `${org.instanceUrl}/_ui/common/apex/debug/ApexCSIPage`;
        vscode.env.openExternal(vscode.Uri.parse(url));
    }

    async sObjectTable(args: any) {
        const { sObjectName } = args;
        const fields = await this.salesforce.fieldsOf(sObjectName);
        const org = await this.salesforce.orgDetails(this.targetOrg);

        createObjectTable(this.context, sObjectName, fields, org.instanceUrl);
    }

    async showObjectTableFromSelection() {
        vscode.window.showInformationMessage('Getting details for the selected sObject...');
        
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);

        if (!selectedText) {
            vscode.window.showInformationMessage('You did not enter anything');
            return;
        }

        await this.createObjectTableForSObject(selectedText);
    }

    async showObjectTableFromInput() {
        vscode.window.showInformationMessage('Getting details for the sObject...');
        
        const input = await vscode.window.showInputBox({
            placeHolder: 'Type at least 2 characters of the sObject name or API name',
        });

        if (!input || input.length < 2) {
            vscode.window.showErrorMessage('Please enter at least 2 characters.');
            return;
        }

        const sObjectName = await this.selectSObjectFromList(input);
        if (!sObjectName) return;

        await this.createObjectTableForSObject(sObjectName);
    }

    async openDebugLogs() {
        openLogsWebViewCmd(this.context);
    }

    async deleteDebugLogs() {
        deleteDebugLogsCmd();
    }

    async showTraceFlags() {
        await openTraceFlagsWebViewCmd(this.context);
    }

    async openLwcFile(resourceUri: vscode.Uri) {
        const previousEditor = vscode.window.activeTextEditor;
        await vscode.commands.executeCommand('vscode.open', resourceUri);
        
        const closePreviousEditor = vscode.workspace.getConfiguration('magicSF').get('closePreviousEditorOnOpen', false);
        
        if (closePreviousEditor && previousEditor && previousEditor.document.uri.toString() !== resourceUri.toString()) {
            await this.closeEditor(previousEditor);
        }
    }

    private async createObjectTableForSObject(sObjectName: string) {
        try {
            const fields = await this.salesforce.fieldsOf(sObjectName);
            
            if (!fields || fields.length === 0) {
                vscode.window.showWarningMessage('No fields found for the specified sObject');
                return;
            }

            const org = await this.salesforce.orgDetails(this.targetOrg);
            await createObjectTable(this.context, sObjectName, fields, org.instanceUrl);
            
        } catch (error) {
            console.error('Error creating sObject table webview:', error);
            vscode.window.showErrorMessage('Failed to create sObject table view');
        }
    }

    private async selectSObjectFromList(input: string): Promise<string | undefined> {
        try {
            const allObjects = await this.salesforce.sObjectsMatchingName(input, 20);
            const sObjects = allObjects.map((obj: any) => ({
                label: obj.label || obj.name,
                description: obj.name,
                value: obj.name
            }));

            if (sObjects.length === 0) {
                vscode.window.showErrorMessage('No matching sObjects found.');
                return;
            }

            const picked = await vscode.window.showQuickPick(sObjects, {
                placeHolder: 'Select an sObject',
                matchOnDescription: true,
            });

            return picked?.value;
            
        } catch (err: any) {
            const errorMessage = err?.message || String(err);
            vscode.window.showErrorMessage('Error fetching sObject list: ' + errorMessage);
        }
    }

    private async closeEditor(editor: vscode.TextEditor) {
        const allGroups = vscode.window.tabGroups.all;
        
        for (const group of allGroups) {
            const tab = group.tabs.find(tab => 
                tab.input instanceof vscode.TabInputText && 
                tab.input.uri.toString() === editor.document.uri.toString()
            );
            
            if (tab) {
                await vscode.window.tabGroups.close(tab, false);
                break;
            }
        }
    }

    async refreshOrgConnection() {
        try {
            await this.salesforce.refreshConnection();
            vscode.window.showInformationMessage('Salesforce connection refreshed successfully.');
        } catch (error: any) {
            vscode.window.showErrorMessage('Failed to refresh Salesforce connection: ' + error.message);
        }
    }
}