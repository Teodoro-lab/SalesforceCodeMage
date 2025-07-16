import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export class LWCExplorerProvider implements vscode.TreeDataProvider<LWCFile> {
    private _onDidChangeTreeData: vscode.EventEmitter<LWCFile | undefined | null > = 
            new vscode.EventEmitter<LWCFile | undefined | null>();
            
    readonly onDidChangeTreeData: vscode.Event<LWCFile | undefined | null> =
        this._onDidChangeTreeData.event;

    private currentLWCFolder: string | null = null;

    constructor() {
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                const filePath = editor.document.uri.fsPath;
                console.log(`Active editor changed: ${filePath}`);
                if (this.isLWCComponent(filePath)) {
                    this.currentLWCFolder = path.dirname(filePath);
                    console.log(`LWC component detected. Current LWC folder: ${this.currentLWCFolder}`);
                    this.refresh();
                } else {
                    this.currentLWCFolder = null;
                    console.log(`Not an LWC component. Clearing current LWC folder.`);
                    this.refresh();
                }
            }
        });
    }

    refresh(): void {
        console.log(`Refreshing tree view...`);
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: LWCFile): vscode.TreeItem {
        return element;
    }

    getChildren(element?: LWCFile): Thenable<LWCFile[]> {
        if (!element) {
            if (this.currentLWCFolder) {
                console.log(`Getting children for folder: ${this.currentLWCFolder}`);
                return Promise.resolve(this.getFilesInLWCFolder(this.currentLWCFolder));
            }
        }
        return Promise.resolve([]);
    }

    private isLWCComponent(filePath: string): boolean {
        const lwcPath = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, "force-app", "main", "default", "lwc");
        console.log(`Checking if ${filePath} is an LWC component. LWC path: ${lwcPath}`);
        return filePath.startsWith(lwcPath);
    }

    private getFilesInLWCFolder(folderPath: string): LWCFile[] {
        console.log(`Getting files in LWC folder: ${folderPath}`);
        const files = fs
            .readdirSync(folderPath)
            .map(
                (file) =>
                    new LWCFile(
                        file,
                        vscode.TreeItemCollapsibleState.None,
                        vscode.Uri.file(path.join(folderPath, file))
                    )
            );
        console.log(`Files found: ${files.map(file => file.label).join(", ")}`);
        return files;
    }
}

class LWCFile extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly resourceUri: vscode.Uri
    ) {
        super(label, collapsibleState);
        this.resourceUri = resourceUri;
        this.command = {
            command: "lwcExplorer.openFile",
            title: "Open File",
            arguments: [resourceUri],
        };
    }
}
