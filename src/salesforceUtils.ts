import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Get the target org from the config file
 * @returns target org alias
 * @throws Error if no workspace is open
 * @throws Error if no config file is found
 * @throws Error if no target org is found in the config file
 **/
export function findWorkspaceTargetOrg() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('No workspace is open.');
    }

    const configPath = path.normalize(path.join(workspaceFolders[0].uri.fsPath, '.sf', 'config.json'));
    if (!fs.existsSync(configPath)) {
        throw new Error('No config file found. Please check if the config file exists in the .sf in the root directory.');
    }

    const data = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(data.toString());
    const configTargetOrg = config['target-org'];

    if (!configTargetOrg) {
        throw new Error('No target org found in config file. Please check if the target-org is present in the config file.');
    }

    return configTargetOrg;
}
