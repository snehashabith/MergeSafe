const path = require('path');
const fs = require('fs-extra');
const { createSandbox } = require('./sandbox');
const { splitFile } = require('./splitterRegex');
const { runTests } = require('./executer');
const { parseTestLogs } = require('./parser');

async function testPipeline() {
    const mockConflictPath = path.join(__dirname, 'mockConflict.js');
    const mockTestPath = path.join(__dirname, 'mockConflict.test.js');

    const paths = await createSandbox(); //create sandboxes for both versions

    await splitFile(mockConflictPath, paths.currentDir, paths.incomingDir); //split the code 

    // Copy your test suite script over to both sandbox folders so jest has target tests to run
    await fs.copy(mockTestPath, path.join(paths.currentDir, 'mockConflict.test.js'));
    await fs.copy(mockTestPath, path.join(paths.incomingDir, 'mockConflict.test.js'));

    await fs.copy(path.join(__dirname, '../../package.json'), path.join(paths.currentDir, 'package.json'));
    await fs.copy(path.join(__dirname, '../../package.json'), path.join(paths.incomingDir, 'package.json'));    

    // Execute both versions in the background and capture their results
    const [currentResult, incomingResult] = await Promise.all([
        runTests(paths.currentDir),
        runTests(paths.incomingDir)
    ]);

    // Impact Analysis
    const finalReport = {
        currentBranch: {
            stable: currentResult.passed,
            analysis: parseTestLogs(currentResult.logs)
        },
        incomingBranch: {
            stable: incomingResult.passed,
            analysis: parseTestLogs(incomingResult.logs)
        }
    };

    const reportPath = path.join(__dirname,'..','..', 'mergeiq-status.json');

    console.log("\nOUTPUT JSON DATA CONTRACT:");
    console.log(JSON.stringify(finalReport, null, 2));
}

testPipeline();