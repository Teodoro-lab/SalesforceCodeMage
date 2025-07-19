import * as vscode from 'vscode';
import { findWorkspaceTargetOrg } from './salesforceUtils';
import { SalesforceAPI } from './salesforceAPI';
import { setupHoverApexProvider } from './hoverProvider';
import { LwcExplorerProvider } from './lwcExplorerProvider';
import { CommandManager } from './commandManager';

export async function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('magicSF is getting activated!');
    
    try {
        const targetOrg = await initializeSalesforceConnection();
        setupProviders(context);
        registerCommands(context, targetOrg);
        
        vscode.window.showInformationMessage('magicSF activated successfully!');
    } catch (error: any) {
        vscode.window.showErrorMessage('Failed to activate magicSF: ' + error.message);
    }
}

async function initializeSalesforceConnection(): Promise<string> {
    const salesforce = SalesforceAPI.getInstance();
    const orgs = await SalesforceAPI.getOrgsInfo();

    const targetOrg = findWorkspaceTargetOrg();
    const targetOrgInfo = orgs.find((org: any) => org.alias === targetOrg);
    
    if (!targetOrgInfo) {
        throw new Error(`Target org '${targetOrg}' not found in available orgs`);
    }

    await salesforce.connect(targetOrgInfo.username);
    return targetOrg;
}

function setupProviders(context: vscode.ExtensionContext) {
    setupHoverApexProvider();
    const lwcExplorerProvider = new LwcExplorerProvider();
    vscode.window.registerTreeDataProvider('lwcExplorer', lwcExplorerProvider);
    vscode.commands.registerCommand('magicSF.refresh', () => lwcExplorerProvider.refresh());
}

function registerCommands(context: vscode.ExtensionContext, targetOrg: string) {
    const commandManager = new CommandManager(context, targetOrg);
    
    const commands = [
        { id: 'magicSF.clearCache', handler: commandManager.clearCache },
        { id: 'magicSF.OpenFlowInOrg', handler: commandManager.openFlowInOrg },
        { id: 'magicSF.openDeveloperConsole', handler: commandManager.openDeveloperConsole },
        { id: 'magicSF.sObjectTable', handler: commandManager.sObjectTable },
        { id: 'magicSF.ShowSObjTable', handler: commandManager.showObjectTableFromInput },
        { id: 'magicSF.ShowSObjTableWithSelectedText', handler: commandManager.showObjectTableFromSelection },
        { id: 'magicSF.openDebugLogs', handler: commandManager.openDebugLogs },
        { id: 'magicSF.deleteDebugLogs', handler: commandManager.deleteDebugLogs },
        { id: 'magicSF.showTraceFlags', handler: commandManager.showTraceFlags },
        { id: 'lwcExplorer.openFile', handler: commandManager.openLwcFile },
        { id: 'magicSF.refreshOrgConnection', handler: commandManager.refreshOrgConnection }
    ];

    commands.forEach(({ id, handler }) => {
        vscode.commands.registerCommand(id, handler);
    });
}