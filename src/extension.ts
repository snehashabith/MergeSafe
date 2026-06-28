import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Fixes contrast readability using native VS Code system theme colors
const currentSuccessDecoration = vscode.window.createTextEditorDecorationType({
    after: {
        contentText: '   ● STABLE (Passes Tests)',
        color: new vscode.ThemeColor('gitDecoration.addedResourceForeground'),
        fontStyle: 'italic'
    }
});

const currentFailureDecoration = vscode.window.createTextEditorDecorationType({
    after: {
        contentText: '   ● UNSTABLE (Fails Tests)',
        color: new vscode.ThemeColor('errorForeground'), 
        fontStyle: 'italic',
        fontWeight: 'bold'
    }
});

const incomingSuccessDecoration = vscode.window.createTextEditorDecorationType({
    after: {
        contentText: '   ● STABLE (Passes Tests)',
        color: new vscode.ThemeColor('gitDecoration.submoduleResourceForeground'), 
        fontStyle: 'italic'
    }
});

const incomingFailureDecoration = vscode.window.createTextEditorDecorationType({
    after: {
        contentText: '   ● UNSTABLE (Fails Tests)',
        color: new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'), 
        fontStyle: 'italic',
        fontWeight: 'bold'
    }
});

// High-speed runtime state cache
let cachedStatus = { currentStable: false, incomingStable: false };

// ASYNCHRONOUS & NON-BLOCKING: Safe backend contract parsing
// ASYNCHRONOUS & NON-BLOCKING: Safe backend contract parsing
async function refreshBranchStatusCache(): Promise<void> {
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;

        const configPath = path.join(workspaceFolders[0].uri.fsPath, 'mergeiq-status.json');
        
        // Asynchronous, non-blocking disk query
        const rawData = await fs.promises.readFile(configPath, 'utf8');
        const statusData = JSON.parse(rawData);
        
        // MATCHING HER EXACT BACKEND CONTRACT STRUCTURE:
        // Reads the individual 'passed' states from the nested current/incoming blocks
        cachedStatus = {
            currentStable: statusData?.current?.passed ?? false,
            incomingStable: statusData?.incoming?.passed ?? false
        };
    } catch (err: any) {
        // Fall back gracefully if the backend pipeline hasn't generated the JSON file yet
        if (err.code !== 'ENOENT') {
            console.error("Could not parse status JSON file:", err);
        }
    }
}
// Instant paint engine avoiding native background overlaps
function updateDecorations(editor: vscode.TextEditor | undefined) {
    if (!editor) return;

    const document = editor.document;
    const currentMarkerRanges: vscode.Range[] = [];
    const separatorMarkerRanges: vscode.Range[] = [];

    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        
        if (line.text.includes('<<<<<<< HEAD')) {
            currentMarkerRanges.push(new vscode.Range(i, 0, i, line.text.length));
        } else if (line.text.includes('=======')) {
            separatorMarkerRanges.push(new vscode.Range(i, 0, i, line.text.length));
        }
    }

    // Paint states instantly without rendering lags
    editor.setDecorations(currentSuccessDecoration, cachedStatus.currentStable ? currentMarkerRanges : []);
    editor.setDecorations(currentFailureDecoration, !cachedStatus.currentStable ? currentMarkerRanges : []);
    editor.setDecorations(incomingSuccessDecoration, cachedStatus.incomingStable ? separatorMarkerRanges : []);
    editor.setDecorations(incomingFailureDecoration, !cachedStatus.incomingStable ? separatorMarkerRanges : []);
}

export class LocalConflictCodeLensProvider implements vscode.CodeLensProvider {
    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const lenses: vscode.CodeLens[] = [];

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            
            if (line.text.includes('<<<<<<< HEAD')) {
                const icon = cachedStatus.currentStable ? "✅" : "⚠️";
                const message = `${icon} Current Changes: Branch is ${cachedStatus.currentStable ? 'STABLE' : 'UNSTABLE'}`;
                lenses.push(new vscode.CodeLens(new vscode.Range(i, 0, i, 0), { title: message, command: "" }));
            }
            if (line.text.includes('=======')) {
                const icon = cachedStatus.incomingStable ? "✅" : "⚠️";
                const message = `${icon} Incoming Changes: Branch is ${cachedStatus.incomingStable ? 'STABLE' : 'UNSTABLE'}`;
                lenses.push(new vscode.CodeLens(new vscode.Range(i, 0, i, 0), { title: message, command: "" }));
            }
        }
        return lenses;
    }
}

export async function activate(context: vscode.ExtensionContext) {
    await refreshBranchStatusCache();

    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ pattern: '**/*' }, new LocalConflictCodeLensProvider())
    );

    // Bulletproof live file system watcher bound to the root directory
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const rootFolder = vscode.workspace.workspaceFolders[0];
        const jsonWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(rootFolder, 'mergeiq-status.json')
        );

        const triggerRefresh = async () => {
            await refreshBranchStatusCache();
            updateDecorations(vscode.window.activeTextEditor);
            // Flushes the CodeLens display immediately upon document updates
            vscode.commands.executeCommand('vscode.refreshCodeLenses');
        };

        jsonWatcher.onDidChange(triggerRefresh);
        jsonWatcher.onDidCreate(triggerRefresh);
        jsonWatcher.onDidDelete(triggerRefresh);
        context.subscriptions.push(jsonWatcher);
    }

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => updateDecorations(editor)),
        vscode.workspace.onDidChangeTextDocument(event => {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && event.document === activeEditor.document) {
                updateDecorations(activeEditor);
            }
        })
    );

    updateDecorations(vscode.window.activeTextEditor);
}

export function deactivate() {
    currentSuccessDecoration.dispose();
    currentFailureDecoration.dispose();
    incomingSuccessDecoration.dispose();
    incomingFailureDecoration.dispose();
}