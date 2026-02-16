import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const HTML_PATH_DEBUG_LOGS_VIEWER = 'templates/debugLogViewer.html';


export class DebugLogViewerProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'salesforce.debugLogViewer';
    private _view?: vscode.WebviewView;
    private _activeEditor?: vscode.TextEditor;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(this._extensionUri.fsPath);

        // Listen for active editor changes
        vscode.window.onDidChangeActiveTextEditor(() => {
            this.updateContent();
        });

        // Listen for document changes
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (event.document === vscode.window.activeTextEditor?.document) {
                this.updateContent();
            }
        });

        // Initial content load
        this.updateContent();

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'refresh':
                        this.updateContent();
                        break;
                    case 'exportJson':
                        this.exportAsJson(message.data);
                        break;
                }
            }
        );
    }

    private updateContent() {
        const activeEditor = vscode.window.activeTextEditor;
        
        if (!activeEditor || !this.isSalesforceLogFile(activeEditor.document.fileName)) {
            this._view?.webview.postMessage({ 
                command: 'updateContent', 
                content: null,
                fileName: null 
            });
            return;
        }

        this._activeEditor = activeEditor;
        const content = activeEditor.document.getText();
        const fileName = path.basename(activeEditor.document.fileName);
        
        const parsedContent = this.parseDebugLog(content);
        
        this._view?.webview.postMessage({ 
            command: 'updateContent', 
            content: parsedContent,
            fileName: fileName
        });
    }

    private isSalesforceLogFile(fileName: string): boolean {
        return fileName.toLowerCase().endsWith('.log');
    }

    private parseDebugLog(content: string): LogCell[] {
        const lines = content.split('\n');
        const cells: LogCell[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (!line) continue;

            // Parse each individual log line
            const parsedLine = this.parseLogLine(line);
            if (parsedLine) {
                cells.push({
                    id: `cell-${cells.length}`,
                    type: parsedLine.type,
                    timestamp: parsedLine.timestamp,
                    content: parsedLine.cleanMessage.trim(),
                    rawContent: line,
                    executionInfo: parsedLine.executionInfo,
                    isCollapsed: false,
                    isJson: parsedLine.jsonContent ? true : false,
                    jsonContent: parsedLine.jsonContent
                });
            }
        }

        return cells;
    }

    private parseLogLine(line: string): ParsedLogLine | null {
        // Parse different Salesforce log formats
        
        // USER_DEBUG format: timestamp (execution)|USER_DEBUG|[line]|DEBUG|message
        const userDebugMatch = line.match(/^(\d{2}:\d{2}:\d{2}\.\d{2})\s+\((\d+)\)\|USER_DEBUG\|\[(\d+)\]\|DEBUG\|(.+)$/);
        if (userDebugMatch) {
            const [, timestamp, execution, lineNum, message] = userDebugMatch;
            const jsonContent = this.tryParseJson(message.trim()) || this.parseSalesforceObjects(message.trim());

            return {
                type: 'debug',
                timestamp,
                cleanMessage: message.trim(),
                executionInfo: `Line ${lineNum}, Execution ${execution}`,
                jsonContent
            };
        }

        // ERROR format
        const errorMatch = line.match(/^(\d{2}:\d{2}:\d{2}\.\d{2})\s+\((\d+)\)\|.*?ERROR.*?\|(.+)$/);
        if (errorMatch) {
            const [, timestamp, execution, message] = errorMatch;
            return {
                type: 'error',
                timestamp,
                cleanMessage: message.trim(),
                executionInfo: `Execution ${execution}`,
                jsonContent: null
            };
        }

        // SOQL_EXECUTE format
        const soqlMatch = line.match(/^(\d{2}:\d{2}:\d{2}\.\d{2})\s+\((\d+)\)\|SOQL_EXECUTE.*?\|(.+)$/);
        if (soqlMatch) {
            const [, timestamp, execution, query] = soqlMatch;
            return {
                type: 'database',
                timestamp,
                cleanMessage: query.trim(),
                executionInfo: `Execution ${execution}`,
                jsonContent: null
            };
        }

        // METHOD_ENTRY/EXIT format
        const methodMatch = line.match(/^(\d{2}:\d{2}:\d{2}\.\d{2})\s+\((\d+)\)\|(METHOD_ENTRY|METHOD_EXIT)\|\[(\d+)\]\|(.+)$/);
        if (methodMatch) {
            const [, timestamp, execution, type, lineNum, method] = methodMatch;
            return {
                type: 'method',
                timestamp,
                cleanMessage: `${type === 'METHOD_ENTRY' ? 'Entering' : 'Exiting'}: ${method}`,
                executionInfo: `Line ${lineNum}, Execution ${execution}`,
                jsonContent: null
            };
        }

        // DML operations
        const dmlMatch = line.match(/^(\d{2}:\d{2}:\d{2}\.\d{2})\s+\((\d+)\)\|(DML_BEGIN|DML_END).*?\|(.+)$/);
        if (dmlMatch) {
            const [, timestamp, execution, operation, details] = dmlMatch;
            return {
                type: 'database',
                timestamp,
                cleanMessage: `${operation === 'DML_BEGIN' ? 'Starting' : 'Completed'} DML: ${details}`,
                executionInfo: `Execution ${execution}`,
                jsonContent: null
            };
        }

        // CALLOUT format
        const calloutMatch = line.match(/^(\d{2}:\d{2}:\d{2}\.\d{2})\s+\((\d+)\)\|CALLOUT.*?\|(.+)$/);
        if (calloutMatch) {
            const [, timestamp, execution, details] = calloutMatch;
            return {
                type: 'callout',
                timestamp,
                cleanMessage: details.trim(),
                executionInfo: `Execution ${execution}`,
                jsonContent: this.tryParseJson(details)
            };
        }

        // Skip lines that don't match our patterns (removed general fallback)
        return null;
    }

    private tryParseJson(text: string): any | null {
        try {
            // Look for standard JSON structures
            const jsonMatch = text.match(/(\{.*\}|\[.*\])/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[1]);
            }
        } catch (e) {
            // Not standard JSON, continue to check for Salesforce objects
        }
        return null;
    }

    private parseSalesforceObjects(text: string): any | null {
        try {
            // Check for Salesforce object list format: (Contact:{Id=..., Name=...}, Contact:{...}, ...)
            const salesforceListMatch = text.match(/\(([^)]+)\)/);
            if (salesforceListMatch) {
                const listContent = salesforceListMatch[1];
                
                // Check if it contains Salesforce object format
                if (listContent.includes(':{') && listContent.includes('=')) {
                    return this.convertSalesforceObjectsToJson(listContent);
                }
            }

            // Check for single Salesforce object: Contact:{Id=003..., Name=John Doe}
            const singleObjectMatch = text.match(/(\w+):\{([^}]+)\}/);
            if (singleObjectMatch) {
                const [, objectType, fields] = singleObjectMatch;
                return this.convertSalesforceObjectToJson(objectType, fields);
            }

        } catch (e) {
            // Not a Salesforce object format
        }
        return null;
    }

    private convertSalesforceObjectsToJson(listContent: string): any[] {
        const objects = [];

        // Split by object boundaries, looking for patterns like "Contact:{...}"
        const objectMatches = listContent.match(/(\w+):\{[^}]+\}/g);

        if (objectMatches) {
            for (const objectMatch of objectMatches) {
                const [, objectType, fields] = objectMatch.match(/(\w+):\{([^}]+)\}/) || [];
                if (fields) {
                    const jsonObject = this.convertSalesforceObjectToJson(objectType, fields);
                    if (jsonObject) {
                        objects.push(jsonObject);
                    }
                }
            }
        }

        return objects.length > 0 ? objects : [];
    }

    private convertSalesforceObjectToJson(objectType: string, fields: string): any | null {
        try {
            const jsonObject: any = { SObject: objectType };
            
            // Parse field=value pairs
            const fieldPairs = fields.split(', ');
            
            for (const pair of fieldPairs) {
                const [key, ...valueParts] = pair.split('=');
                const value = valueParts.join('='); // Handle values that contain '='
                
                if (key && value) {
                    jsonObject[key.trim()] = value.trim();
                }
            }
            
            return jsonObject;
        } catch (e) {
            return null;
        }
    }

    private async exportAsJson(data: any) {
        try {
            const jsonString = JSON.stringify(data, null, 2);
            const doc = await vscode.workspace.openTextDocument({
                content: jsonString,
                language: 'json'
            });
            await vscode.window.showTextDocument(doc);
        } catch (error) {
            vscode.window.showErrorMessage('Failed to export JSON: ' + error);
        }
    }

    private _getHtmlForWebview(extPath: string): string {
        const htmlPath = path.normalize(path.join(extPath, HTML_PATH_DEBUG_LOGS_VIEWER));
        return fs.readFileSync(htmlPath, 'utf-8');
    }
}

// Types
interface LogCell {
    id: string;
    type: LogCellType;
    timestamp: string | null;
    content: string;
    rawContent?: string;
    executionInfo?: string | null;
    isCollapsed: boolean;
    isJson: boolean;
    jsonContent?: any;
}

interface ParsedLogLine {
    type: LogCellType;
    timestamp: string | null;
    cleanMessage: string;
    executionInfo: string | null;
    jsonContent: any | null;
}

type LogCellType = 
    | 'debug' 
    | 'error' 
    | 'warning' 
    | 'info' 
    | 'method' 
    | 'constructor'
    | 'database' 
    | 'system' 
    | 'validation'
    | 'user' 
    | 'callout';