import * as vscode from 'vscode';
import { SalesforceAPI } from './salesforceAPI';

function escapeMarkdown(text: string): string {
    return text.replace(/([\\`*_{}[\]()#+\-.!])/g, '\\$1');
}

function generateCommandUri(word: string): string {
    const args = { sObjectName: word };
    const commandArgs = encodeURIComponent(JSON.stringify(args));
    return `command:magicSF.sObjectTable?${commandArgs}`;
}

function createHoverContent(fields: any[], word: string): vscode.Hover {
    const markdownString = new vscode.MarkdownString();
    markdownString.isTrusted = true;
    const commandUri = generateCommandUri(word);
    markdownString.appendMarkdown(`## Field details for ${escapeMarkdown(word)}\n`);
    markdownString.appendMarkdown(`[View Detailed Information](${commandUri})`);
    return new vscode.Hover(markdownString);
}

async function provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover> {
    const wordRange = document.getWordRangeAtPosition(position);
    const word = document.getText(wordRange);
    const salesforce = SalesforceAPI.getInstance();
    const fields = await salesforce.fieldsOf(word);

    if (fields) {
        return createHoverContent(fields, word);
    }

    return new vscode.Hover('No information available');
}

export function setupHoverApexProvider(): void {
    vscode.languages.registerHoverProvider('apex', {
        provideHover(document, position, token) {
            return provideHover(document, position);
        }
    });
}
