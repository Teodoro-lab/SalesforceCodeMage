import * as vscode from 'vscode';
import { SalesforceAPI } from '../SalesforceAPI';
import * as path from 'path';
import * as fs from 'fs';
import { fillHtmlContent } from './sObjectHtml';

/**
 * Show the sObject table in a webview
 * @param context vscode.ExtensionContext
 * @param connection jsforce.Connection
 * @param sObjectName string @example 'Account' 
 **/
export async function showSObjTable(context: vscode.ExtensionContext, sObjectName: string, fields: any[], instanceUrl?: string) {
    if (sObjectName) {
        const extPath = context.extensionPath;
        createSObjTableWebView(extPath, fields, sObjectName, instanceUrl, context);
    } else {
        vscode.window.showInformationMessage('You did not enter anything');
    }
}


/**
 * Create the table web view for the sObject based on the fields using the html template file.
 * @param extPath string
 * @param fields any[]
 * @param sObjectName string
 **/
export async function createSObjTableWebView(extPath: string, fields: any[], sObjectName: string, instanceUrl?: string, context?: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        'objFields',
        sObjectName + ' Fields',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            enableCommandUris: true,
            retainContextWhenHidden: true,
        }
    );
    let codiconsUri; 
    if (context){
        console.log(`Context provided, using codicons URI.`);
        codiconsUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));
    }
    
    const htmlPath = path.normalize(path.join(extPath, 'webviewTemplates/sObjectFieldsTable.html'));
    let htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    htmlContent = htmlContent.replace('${codiconsUri}', codiconsUri ? codiconsUri.toString() : '');
    console.log(`HTML content loaded from: ${htmlPath}`);
    const filledHtml = fillHtmlContent(htmlContent, fields, sObjectName, instanceUrl);
    panel.webview.html = filledHtml;
}