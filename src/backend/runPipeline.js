const path = require('path');
const fs = require('fs-extra');
const { createSandbox } = require('./sandbox');
const { splitFile } = require('./splitterRegex');
const { runTests } = require('./executer');
const { parseTestLogs } = require('./parser');

function findMatchingTestFile(sourceFilePath) {
    const dir = path.dirname(sourceFilePath);
    const ext = path.extname(sourceFilePath);
    const baseName = path.basename(sourceFilePath, ext);

    const possibleTestPaths = [
        path.join(dir, `${baseName}.test${ext}`),
        path.join(dir, `${baseName}.spec${ext}`),
        path.join(dir, '__tests__', `${baseName}.test${ext}`),
        path.join(dir, '__tests__', `${baseName}${ext}`)
    ];

    for (const testPath of possibleTestPaths) {
        if (fs.existsSync(testPath)) {
            return testPath;
        }
    }
    return null; 
}

//if no tests exist
async function writeDirectExecutionWrapper(directory) {
    const runnerContent = `
try {
    const moduleInstance = require('./resolved.js');
    const exportedKeys = Object.keys(moduleInstance);
    
    if (exportedKeys.length > 0) {
        const firstExport = moduleInstance[exportedKeys[0]];
        if (typeof firstExport === 'function') {
            // Dry run invocation to check for basic runtime exceptions or syntax crashes
            firstExport();
        }
    }
    console.log("EXECUTION_SUCCESS");
} catch (error) {
    console.error("RUNTIME_CRASH:\\n" + error.stack);
    process.exit(1);
}
`;
    await fs.writeFile(path.join(directory, 'runner.js'), runnerContent);
}

async function testPipeline(targetFilePath) {
    const activeTestFilePath = targetFilePath || path.join(__dirname, 'mockConflict.js');
    const workspaceRoot = path.dirname(activeTestFilePath);
    console.log(`\nTesting pipeline for: ${path.basename(activeTestFilePath)}`);

    const paths = await createSandbox(); //create sandboxes for both versions

    await splitFile(activeTestFilePath, paths.currentDir, paths.incomingDir); //split the code 

    const sourceNodeModules=path.join(workspaceRoot, 'node_modules');
    if (fs.existsSync(sourceNodeModules)) {
        await fs.ensureSymlink(sourceNodeModules, path.join(paths.currentDir, 'node_modules'),'junction');
        await fs.ensureSymlink(sourceNodeModules, path.join(paths.incomingDir, 'node_modules'),'junction');
    }

    const sourcePackageJson=path.join(workspaceRoot, 'package.json');
    if (fs.existsSync(sourcePackageJson)) {
        await fs.copy(sourcePackageJson, path.join(paths.currentDir, 'package.json'));
        await fs.copy(sourcePackageJson, path.join(paths.incomingDir, 'package.json'));
    }else{
        const dummyPackageJson={
            name: "dummy-package",
            version: "1.0.0",
        }
        await fs.writeJson(path.join(paths.currentDir, 'package.json'), dummyPackageJson, { spaces: 2 });
        await fs.writeJson(path.join(paths.incomingDir, 'package.json'), dummyPackageJson, { spaces: 2 });
    }

    // Copy test suite script over to both sandbox folders so jest has target tests to run
    await fs.copy(path.join(workspaceRoot, 'package.json'), path.join(paths.currentDir, 'package.json'));
    await fs.copy(path.join(workspaceRoot, 'package.json'), path.join(paths.incomingDir, 'package.json'));

   const realTestPath=findMatchingTestFile(activeTestFilePath);
   let runMode='test';

   if(realTestPath){
    console.log(`Matching unit test found: ${path.basename(realTestPath)}`);
    const originalFilename= path.basename(activeTestFilePath,path.extname(activeTestFilePath));

    const sandboxTestCurrent=path.join(paths.currentDir, path.basename(realTestPath));
    const sandboxTestIncoming=path.join(paths.incomingDir, path.basename(realTestPath));

    await fs.copy(realTestPath, sandboxTestCurrent);
    await fs.copy(realTestPath, sandboxTestIncoming);

    for (const file of [sandboxTestCurrent, sandboxTestIncoming]) {
        let content= await fs.readFile(file, 'utf8');
        const importRegex= new RegExp(`(require\\(['"\\].*\\/)${originalFilename}(['"]\\))`, 'g');
        content = content.replace(importRegex, `$1resolved$2`);
        await fs.writeFile(file, content, 'utf8');
    }

}else{
    console.log('No matching unit test found.');
    runMode='direct';
    await writeDirectExecutionWrapper(paths.currentDir);
    await writeDirectExecutionWrapper(paths.incomingDir);
}

const [currentResult, incomingResult] = await Promise.all([
        runTests(paths.currentDir, runMode),
        runTests(paths.incomingDir, runMode)
    ]);

const finalReport = {
    currentBranch: {
        passed: currentResult.passed,
        analysis: parseTestLogs(currentResult.logs),
        rawLogs: currentResult.logs
    },
    incomingBranch: {
        passed: incomingResult.passed,
        analysis: parseTestLogs(incomingResult.logs),
        rawLogs: incomingResult.logs
    }
};

const reportPath =path.join(workspaceRoot,'mergeiq-status.json');
await fs.writeJson(reportPath,finalReport, { spaces: 2 });

console.log("\nOUTPUT JSON DATA CONTRACT");
console.log(JSON.stringify(finalReport, null, 2));

return finalReport;
}

if (require.main === module) {
    testPipeline();
}

module.exports = { testPipeline };