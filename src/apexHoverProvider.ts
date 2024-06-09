import * as vscode from 'vscode';

function escapeMarkdown(text: string): string {
    return text.replace(/([\\`*_{}[\]()#+\-.!])/g, '\\$1');
}

function generateCommandUri(word: string): string {
    const args = { sObjectName: word };
    const commandArgs = encodeURIComponent(JSON.stringify(args));
    return `command:magicSF.sObjectTable?${commandArgs}`;
}

function formatFieldDetails(field: any): string {
    const label = escapeMarkdown(field.label);
    const name = escapeMarkdown(field.name);
    const type = escapeMarkdown(field.type);
    const length = field.length || 'N/A';

    let picklistLabels = 'None';
    if (field.picklistValues && field.picklistValues.length > 0) {
        picklistLabels = field.picklistValues.map((v: { label: string; }) => escapeMarkdown(v.label)).join(', ');
    }

    const properties = [];
    if (field.createable) properties.push('Createable');
    if (field.defaultedOnCreate) properties.push('Defaulted On Create');
    if (!field.nillable) properties.push('Required');

    return `\n**${label} (${name})** - Type: ${type}, ${properties.join(', ')}, Length: ${length}, Picklist Values: ${picklistLabels}\n`;
}

function createHoverContent(fields: any[], word: string): vscode.Hover {
    const markdownString = new vscode.MarkdownString();
    markdownString.isTrusted = true;

    if (fields && fields.length > 0) {
        const commandUri = generateCommandUri(word);
        markdownString.appendMarkdown(`## Field details for ${escapeMarkdown(word)}\n`);
        markdownString.appendMarkdown(`[View Detailed Information](${commandUri})\n\n`);

        fields.forEach((field) => {
            markdownString.appendMarkdown(formatFieldDetails(field));
        });
    } else {
        markdownString.appendMarkdown('\nNo information available');
    }

    return new vscode.Hover(markdownString);
}

async function provideHover(document: vscode.TextDocument, position: vscode.Position, connection: any, SalesforceAPI: any): Promise<vscode.Hover> {
    const wordRange = document.getWordRangeAtPosition(position);
    const word = document.getText(wordRange);
    const fields = await SalesforceAPI.fetchFields(connection, word);

    if (fields) {
        return createHoverContent(fields, word);
    }

    return new vscode.Hover('No information available');
}

export function setupHoverApexProvider(connection: any, SalesforceAPI: any): void {
    vscode.languages.registerHoverProvider('apex', {
        provideHover(document, position, token) {
            return provideHover(document, position, connection, SalesforceAPI);
        }
    });
}
