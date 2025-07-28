/**
 * Get extension context - now uses stored global context
 */
function getExtensionContext(): vscode.ExtensionContext | undefined {
    return globalExtensionContext;
}import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { SalesforceAPI } from '../salesforceAPI';

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
    data: any;
}

interface QueryExecutionData {
    query: string;
    sObjectName: string;
    sourceTitle?: string;
}

interface QueryResultData {
    records: any[];
    totalSize: number;
}

interface QueryErrorData {
    error: string;
    errorCode?: string;
}

const HTML_TEMPLATE_PATH = process.platform === 'darwin'
    ? 'templates/objectTable.html'
    : 'templates/objectTable.html';
const QUERY_RESULTS_TEMPLATE_PATH = process.platform === 'darwin'
    ? 'templates/queryResults.html'
    : 'templates/queryResults.html';

// Global registry to track open webview panels
const openWebviewPanels = new Map<string, vscode.WebviewPanel>();

// Store extension context globally (set this when your extension activates)
let globalExtensionContext: vscode.ExtensionContext | undefined = undefined;

/**
 * Initialize the object table manager with extension context
 * Call this from your extension's activate() function
 */
export function initializeObjectTableManager(context: vscode.ExtensionContext): void {
    globalExtensionContext = context;
}

/**
 * Creates and configures the sObject table webview panel with query functionality
 * Reuses existing panel if one exists for the same sObject
 */
export async function createObjectTable( 
    context: vscode.ExtensionContext,
    sObjectName: string, 
    fields: any[] = [], // Accepts any[] instead of FieldData[]
    instanceUrl?: string, 
): Promise<vscode.WebviewPanel> {
    
    const panelKey = `objFields_${sObjectName}`;
    
    // Check if panel already exists for this sObject
    let panel = openWebviewPanels.get(panelKey);
    
    if (panel !== undefined) {
        // Panel exists, reveal it and update data
        panel.reveal(vscode.ViewColumn.One);
        
        // Update with new data
        const viewData: SObjectViewData = {
            sObjectName,
            fields,
            instanceUrl
        };
        
        postMessageToWebView(panel, 'initializeData', viewData);
        return panel;
    }
    
    // Create new panel
    panel = createWebViewPanel(sObjectName);
    const codiconsUri = getCodiconsUri(panel, context);
    
    setupWebViewContent(panel, context.extensionPath, codiconsUri);
    setupMessageHandling(panel);
    
    // Register panel in our tracking map
    openWebviewPanels.set(panelKey, panel);
    
    // Clean up when panel is disposed
    panel.onDidDispose(() => {
        openWebviewPanels.delete(panelKey);
    });
    
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
            
        case 'executeQueryInNewTab':
            handleExecuteQueryInNewTab(panel, message.data);
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
 * Handles SOQL query execution in a new tab
 */
async function handleExecuteQueryInNewTab(sourcePanel: vscode.WebviewPanel, data: QueryExecutionData): Promise<void> {
    const { query, sObjectName, sourceTitle } = data;
    
    try {
        console.log(`Executing query for ${sObjectName} in new tab:`, query);
        
        // Execute the query
        const queryResult = await executeSalesforceQuery(query);
        console.log(`Query executed successfully for ${sObjectName}`, queryResult);
        
        // Create new webview panel for results
        const resultsPanel = createQueryResultsPanel(query, sObjectName, sourceTitle);
        console.log(`Created new query results panel for ${sObjectName}`);
        console.log(resultsPanel);
        
        // Setup the results panel
        const context = getExtensionContext(); // You'll need to store/access context
        if (context) {
            console.log('Setting up query results panel with context:', context);
            const codiconsUri = getCodiconsUri(resultsPanel, context);
            setupQueryResultsContent(resultsPanel, context.extensionPath, codiconsUri);
            console.log('Setting up message handling for query results panel');
            setupQueryResultsMessageHandling(resultsPanel);
            console.log('Posting initial message to query results panel');
            
            // Send results to the new panel
            setTimeout(() => {
                console.log('Posting results to query results panel:', queryResult);
                postMessageToWebView(resultsPanel, 'displayResults', {
                    query,
                    sObjectName,
                    records: queryResult.records,
                    totalSize: queryResult.totalSize
                });
            }, 1000);
        }
        
    } catch (error) {
        console.error('Query execution error:', error);
        vscode.window.showErrorMessage(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Creates a webview panel specifically for query results
 */
function createQueryResultsPanel(query: string, sObjectName: string, sourceTitle?: string): vscode.WebviewPanel {
    const title = `Query Results: ${sObjectName}`;
    
    return vscode.window.createWebviewPanel(
        'queryResults',
        title,
        vscode.ViewColumn.Two, // Open in second column
        {
            enableScripts: true,
            enableCommandUris: true,
            retainContextWhenHidden: true,
        }
    );
}

/**
 * Sets up the HTML content for query results panel
 */
function setupQueryResultsContent(panel: vscode.WebviewPanel, extPath: string, codiconsUri: string): void {
    // First try to load a dedicated query results template
    const queryResultsHtmlPath = path.normalize(path.join(extPath, QUERY_RESULTS_TEMPLATE_PATH));
    
    let htmlContent: string;
    
    try {
        htmlContent = fs.readFileSync(queryResultsHtmlPath, 'utf-8');
        htmlContent = htmlContent.replace('${codiconsUri}', codiconsUri);
        panel.webview.html = htmlContent;
    } catch (error) {
        console.log('Query results template not found, using inline HTML');
    }
}

/**
 * Sets up message handling for query results panel
 */
function setupQueryResultsMessageHandling(panel: vscode.WebviewPanel): void {
    panel.webview.onDidReceiveMessage((message) => {
        switch (message.command) {
            case 'copyToClipboard':
                handleCopyToClipboard(message.data);
                break;
            case 'exportResults':
                handleExportResults(message.data);
                break;
            case 'webviewReady':
                console.log('Query results webview is ready');
                break;
            default:
                console.warn('Unknown query results message command:', message.command);
        }
    });
}


/**
 * Handle exporting query results to CSV
 */
function handleExportResults(data: any): void {
    try {
        if (!data.records || data.records.length === 0) {
            vscode.window.showInformationMessage('No data to export');
            return;
        }
        
        // Convert to CSV
        const records = data.records;
        const allKeys = new Set<string>();
        
        // Get all unique keys
        records.forEach((record: any) => {
            Object.keys(record).forEach(key => {
                if (key !== 'attributes') {
                    allKeys.add(key);
                }
            });
        });
        
        const keys = Array.from(allKeys);
        
        // Build CSV content
        let csvContent = keys.join(',') + '\n';
        
        records.forEach((record: any) => {
            const row = keys.map(key => {
                const value = record[key];
                const stringValue = value === null || value === undefined ? '' : String(value);
                // Escape commas and quotes
                return stringValue.includes(',') || stringValue.includes('"') 
                    ? `"${stringValue.replace(/"/g, '""')}"` 
                    : stringValue;
            });
            csvContent += row.join(',') + '\n';
        });
        
        // Save file
        vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`${data.sObjectName}_query_results.csv`),
            filters: {
                'CSV Files': ['csv'],
                'All Files': ['*']
            }
        }).then(uri => {
            if (uri) {
                require('fs').writeFileSync(uri.fsPath, csvContent, 'utf8');
                vscode.window.showInformationMessage(`Results exported to ${uri.fsPath}`);
            }
        });
        
    } catch (error) {
        console.error('Export error:', error);
        vscode.window.showErrorMessage('Failed to export results');
    }
}

/**
 * Execute SOQL query against Salesforce
 * TODO: This is where you'll implement your actual Salesforce API integration
 * 
 * @param query The SOQL query to execute
 * @returns Promise with query results
 */
async function executeSalesforceQuery(query: string): Promise<QueryResultData | any> {
    let salesforce = SalesforceAPI.getInstance();
    let results = await salesforce.fetchRecords(query);
    let data : QueryResultData = {
        records: results,
        totalSize: results.length
    };

    console.log('Executing query:', query);
    console.log('Query results:', results);

    return data;
}


/**
 * Posts a message to the webview with the specified command and data
 */
function postMessageToWebView(panel: vscode.WebviewPanel | undefined, command: string, data: any): void {
    if (!panel) {
        console.error('Webview panel is not defined');
        return;
    }

    const message: WebViewMessageData = {
        command,
        data
    };
    
    panel.webview.postMessage(message).then(
        () => console.log(`Message posted successfully: ${command}`),
        (error) => console.error('Error posting message:', error)
    );
}

/**
 * Additional utility functions for query building and validation
 */

/**
 * Validates a SOQL query for basic syntax issues
 */
export function validateSOQLQuery(query: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!query.trim()) {
        errors.push('Query cannot be empty');
        return { isValid: false, errors };
    }
    
    const upperQuery = query.toUpperCase().trim();
    
    // Basic validation checks
    if (!upperQuery.startsWith('SELECT')) {
        errors.push('Query must start with SELECT');
    }
    
    if (!upperQuery.includes('FROM')) {
        errors.push('Query must include FROM clause');
    }
    
    // Check for balanced parentheses
    const openParens = (query.match(/\(/g) || []).length;
    const closeParens = (query.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
        errors.push('Unbalanced parentheses in query');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Formats a SOQL query for better readability
 */
export function formatSOQLQuery(query: string): string {
    return query
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/\s*,\s*/g, ', ') // Clean up commas
        .replace(/\bSELECT\b/gi, 'SELECT\n  ')
        .replace(/\bFROM\b/gi, '\nFROM')
        .replace(/\bWHERE\b/gi, '\nWHERE')
        .replace(/\bORDER BY\b/gi, '\nORDER BY')
        .replace(/\bLIMIT\b/gi, '\nLIMIT')
        .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
        .replace(/\bHAVING\b/gi, '\nHAVING')
        .trim();
}

/**
 * Extracts field names from a list of selected fields for query building
 */
export function buildFieldListForQuery(selectedFields: string[]): string {
    if (selectedFields.length === 0) {
        return 'Id';
    }
    
    // Remove duplicates and sort
    const uniqueFields = [...new Set(selectedFields)].sort();
    
    // Always include Id if not already present
    if (!uniqueFields.includes('Id')) {
        uniqueFields.unshift('Id');
    }
    
    return uniqueFields.join(', ');
}