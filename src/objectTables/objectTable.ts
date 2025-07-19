import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

interface FieldData {
    name: string;
    label: string;
    type: string;
    length?: number;
    nillable: boolean;
    createable: boolean;
    defaultedOnCreate: boolean;
    picklistValues?: Array<{ label: string; value: string; }>;
}

interface SObjectViewData {
    sObjectName: string;
    fields: FieldData[];
    instanceUrl?: string;
}

interface WebViewMessageData {
    command: string;
    data: SObjectViewData;
}

const HTML_TEMPLATE_PATH = 'src/objectTables/objectTable.html';


/**
 * Creates and configures the sObject table webview panel
 */
export async function createObjectTable( 
    context: vscode.ExtensionContext,
    sObjectName: string, 
    fields: any[] = [], // Accepts any[] instead of FieldData[]
    instanceUrl?: string, 
): Promise<vscode.WebviewPanel> {
    
    const panel = createWebViewPanel(sObjectName);
    const codiconsUri = getCodiconsUri(panel, context);
    
    setupWebViewContent(panel, context.extensionPath, codiconsUri);
    setupMessageHandling(panel);
    
    // Send initial data to webview once it's ready
    const viewData: SObjectViewData = {
        sObjectName,
        fields,
        instanceUrl
    };
    
    // Post message after a brief delay to ensure webview is ready
    setTimeout(() => {
        postMessageToWebView(panel, 'initializeData', viewData);
    }, 100);
    
    return panel;
}

/**
 * Creates the webview panel with standard configuration
 */
function createWebViewPanel(sObjectName: string): vscode.WebviewPanel {
    return vscode.window.createWebviewPanel(
        'objFields',
        `${sObjectName} Fields`,
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            enableCommandUris: true,
            retainContextWhenHidden: true,
        }
    );
}

/**
 * Gets the codicons URI for styling
 */
function getCodiconsUri(panel: vscode.WebviewPanel, context?: vscode.ExtensionContext): string {
    if (!context) {
        console.warn('No context provided, codicons may not load properly.');
        return '';
    }
    
    const codiconsUri = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
    );
    
    return codiconsUri.toString();
}

/**
 * Sets up the webview HTML content
 */
function setupWebViewContent(panel: vscode.WebviewPanel, extPath: string, codiconsUri: string): void {
    const htmlPath = path.normalize(path.join(extPath, HTML_TEMPLATE_PATH));

    try {
        let htmlContent = fs.readFileSync(htmlPath, 'utf-8');
        htmlContent = htmlContent.replace('${codiconsUri}', codiconsUri);
        panel.webview.html = htmlContent;
    } catch (error) {
        console.error('Error reading HTML template:', error);
        vscode.window.showErrorMessage('Failed to load HTML template for sObject table.');
    }
}

/**
 * Sets up message handling between extension and webview
 */
function setupMessageHandling(panel: vscode.WebviewPanel): void {
    panel.webview.onDidReceiveMessage((message) => {
        handleWebViewMessage(panel, message);
    });
}

/**
 * Handles messages received from the webview
 */
function handleWebViewMessage(panel: vscode.WebviewPanel, message: any): void {
    switch (message.command) {
        case 'copyToClipboard':
            handleCopyToClipboard(message.data);
            break;
            
        case 'openFieldInSalesforce':
            handleOpenFieldInSalesforce(message.data);
            break;
            
        case 'openObjectInSalesforce':
            handleOpenObjectInSalesforce(message.data);
            break;
            
        case 'webviewReady':
            console.log('Webview is ready to receive data');
            break;
            
        default:
            console.warn('Unknown message command:', message.command);
    }
}

/**
 * Handles clipboard copy operations
 */
function handleCopyToClipboard(data: any): void {
    try {
        const jsonString = JSON.stringify(data, null, 2);
        vscode.env.clipboard.writeText(jsonString).then(() => {
            vscode.window.showInformationMessage('Object data copied to clipboard');
        });
    } catch (error) {
        console.error('Error copying to clipboard:', error);
        vscode.window.showErrorMessage('Failed to copy data to clipboard');
    }
}

/**
 * Handles opening field in Salesforce Setup
 */
function handleOpenFieldInSalesforce(data: { instanceUrl: string; sObjectName: string; fieldName: string }): void {
    const { instanceUrl, sObjectName, fieldName } = data;
    const fieldUrl = `${instanceUrl}/lightning/setup/ObjectManager/${sObjectName}/FieldsAndRelationships/${fieldName}/view`;
    
    vscode.env.openExternal(vscode.Uri.parse(fieldUrl));
}

/**
 * Handles opening object in Salesforce Setup
 */
function handleOpenObjectInSalesforce(data: { instanceUrl: string; sObjectName: string }): void {
    const { instanceUrl, sObjectName } = data;
    const objectUrl = `${instanceUrl}/lightning/setup/ObjectManager/${sObjectName}/Details/view`;
    
    vscode.env.openExternal(vscode.Uri.parse(objectUrl));
}

/**
 * Posts a message to the webview with the specified command and data
 */
function postMessageToWebView(panel: vscode.WebviewPanel, command: string, data: any): void {
    const message: WebViewMessageData = {
        command,
        data
    };
    
    panel.webview.postMessage(message).then(
        () => console.log(`Message posted successfully: ${command}`),
        (error) => console.error('Error posting message:', error)
    );
}
