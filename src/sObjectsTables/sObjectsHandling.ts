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
export async function showSObjTable(context: vscode.ExtensionContext, sObjectName: string, fields: any[]) {
    if (sObjectName) {
        const extPath = context.extensionPath;
        createSObjTableWebView(extPath, fields, sObjectName);
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
export async function createSObjTableWebView(extPath: string, fields: any[], sObjectName: string) {
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
    const htmlPath = path.normalize(path.join(extPath, 'webviewTemplates/sObjectFieldsTable.html'));
    let htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    const filledHtml = fillHtmlContent(htmlContent, fields, sObjectName);
    panel.webview.html = filledHtml;
}