import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Define our two dynamic decoration styles
const failureDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 0, 0, 0.12)', // Subtle Red
    isWholeLine: true
});

const successDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(0, 255, 0, 0.08)', // Subtle Green
    isWholeLine: true
});

export class LocalConflictCodeLensProvider implements vscode.CodeLensProvider {
    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const lenses: vscode.CodeLens[] = [];
        const highlightRanges: vscode.Range[] = [];
        
        // 1. Fallback default values if the JSON file isn't found
        let author = "Unknown Developer";
        let passesTests = false;

        try {
            // Attempt to find and read your partner's JSON file from the project root
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders) {
                const configPath = path.join(workspaceFolders[0].uri.fsPath, 'mergeiq-status.json');
                if (fs.existsSync(configPath)) {
                    const rawData = fs.readFileSync(configPath, 'utf8');
                    const statusData = JSON.parse(rawData);
                    
                    author = statusData.authorName || author;
                    passesTests = statusData.testsPassed;
                }
            }
        } catch (err) {
            console.error("Could not read status JSON file:", err);
        }

        // 2. Scan lines for conflict markers
        let conflictStartIndex = -1;
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            
            if (line.text.includes('<<<<<<< HEAD')) {
                conflictStartIndex = i;
                const range = new vscode.Range(i, 0, i, 0);
                
                // Build dynamic text message based on JSON status
                const icon = passesTests ? "✅" : "⚠️";
                const testStatus = passesTests ? "PASSES stability tests." : "FAILS stability tests.";
                const uiMessage = `${icon} Local Sandbox: Code changes by ${author} ${testStatus}`;
                
                lenses.push(new vscode.CodeLens(range, {
                    title: uiMessage,
                    command: ""
                }));
            }

            if (line.text.includes('>>>>>>>') && conflictStartIndex !== -1) {
                const decorationRange = new vscode.Range(conflictStartIndex, 0, i, line.text.length);
                highlightRanges.push(decorationRange);
                conflictStartIndex = -1;
            }
        }

        // 3. Clear old decorations and paint the dynamic ones
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            // Clear both styles first so they don't overlap
            activeEditor.setDecorations(failureDecoration, []);
            activeEditor.setDecorations(successDecoration, []);

            if (highlightRanges.length > 0) {
                // Pick color depending on test state
                const targetDecoration = passesTests ? successDecoration : failureDecoration;
                activeEditor.setDecorations(targetDecoration, highlightRanges);
            }
        }

        return lenses;
    }
}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ pattern: '**/*' }, new LocalConflictCodeLensProvider())
    );
}

export function deactivate() {
    failureDecoration.dispose();
    successDecoration.dispose();
}