const path = require('path');
const fs = require('fs-extra');
const { createSandbox, cleanupSandbox } = require('./sandbox');
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

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findNearestFile(startDir, fileName) {
    let currentDir = path.resolve(startDir);

    while (true) {
        const candidate = path.join(currentDir, fileName);
        if (await fs.pathExists(candidate)) {
            return candidate;
        }

        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            return null;
        }
        currentDir = parentDir;
    }
}

async function readPackageJson(packageJsonPath) {
    if (!packageJsonPath) {
        return null;
    }

    try {
        return await fs.readJson(packageJsonPath);
    } catch (error) {
        console.error(`Could not read package.json at ${packageJsonPath}:`, error);
        return null;
    }
}

async function writeSandboxPackageJson(directory, packageJson) {
    const sandboxPackageJson = {
        ...(packageJson || {
            name: "merge-safe-sandbox",
            version: "1.0.0"
        }),
        scripts: {
            ...(packageJson?.scripts || {}),
            test: packageJson?.scripts?.test || "jest --runInBand"
        }
    };

    await fs.writeJson(path.join(directory, 'package.json'), sandboxPackageJson, { spaces: 2 });
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
    const sourceDir = path.dirname(activeTestFilePath);
    const sourcePackageJson = await findNearestFile(sourceDir, 'package.json');
    const extensionPackageJson = await findNearestFile(__dirname, 'package.json');
    const workspaceRoot = sourcePackageJson ? path.dirname(sourcePackageJson) : sourceDir;
    const dependencyRoot = sourcePackageJson ? path.dirname(sourcePackageJson) : path.dirname(extensionPackageJson || __dirname);
    const sourceNodeModules = path.join(dependencyRoot, 'node_modules');
    const packageJson = await readPackageJson(sourcePackageJson);
    console.log(`\nTesting pipeline for: ${path.basename(activeTestFilePath)}`);

    const paths = await createSandbox({
        nodeModulesDir: sourceNodeModules
    }); //create sandboxes for both versions

    try {
    console.log("Current Sandbox:", paths.currentDir);
    console.log("Incoming Sandbox:", paths.incomingDir);

    await splitFile(activeTestFilePath, paths.currentDir, paths.incomingDir); //split the code 

    await writeSandboxPackageJson(paths.currentDir, packageJson);
    await writeSandboxPackageJson(paths.incomingDir, packageJson);

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
        const escapedOriginalFilename = escapeRegex(originalFilename);
        const requireRegex = new RegExp(`require\\(\\s*(['"])(\\.{1,2}\\/[^'"]*?)${escapedOriginalFilename}(?:\\.js)?\\1\\s*\\)`, 'g');
        content = content.replace(requireRegex, "require('./resolved.js')");
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

const currentAnalysis = parseTestLogs(currentResult.logs);
const incomingAnalysis = parseTestLogs(incomingResult.logs);

const finalReport = {
    current: {
        passed: currentResult.passed,
        analysis: currentAnalysis,
        rawLogs: currentResult.logs
    },
    incoming: {
        passed: incomingResult.passed,
        analysis: incomingAnalysis,
        rawLogs: incomingResult.logs
    },
    currentBranch: {
        passed: currentResult.passed,
        analysis: currentAnalysis,
        rawLogs: currentResult.logs
    },
    incomingBranch: {
        passed: incomingResult.passed,
        analysis: incomingAnalysis,
        rawLogs: incomingResult.logs
    }
};

const reportPath =path.join(workspaceRoot,'mergeiq-status.json');
await fs.writeJson(reportPath,finalReport, { spaces: 2 });

console.log("\nOUTPUT JSON DATA CONTRACT");
console.log(JSON.stringify(finalReport, null, 2));

return finalReport;
    } finally {
        await cleanupSandbox(paths);
    }
}

if (require.main === module) {
    testPipeline(process.argv[2]);
}

module.exports = { testPipeline };
