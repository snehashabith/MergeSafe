const {exec} = require('child_process');


function runTests(directory, runMode='test'){
    return new Promise((resolve) => {
        const command = runMode === 'direct' ? 'node runner.js' : 'npm run test';

        exec(command, {cwd: directory, maxBuffer: 1024 * 1024 * 2 }, (error, stdout, stderr) => {
            const rawLogs=stderr || stdout || '';
            let passed =error === null;

            if (runMode === 'direct'){
                passed= error===null && rawLogs.includes('EXECUTION_SUCCESS');
            }

            if (error && runMode === 'test' && rawLogs.includes("FAIL") && !rawLogs.includes("Test")) {
                return resolve({
                    passed: false,
                    logs: `error: ${error.message}`
                });
            }

            resolve({
                passed:passed,
                logs:rawLogs
            });
        });
    });
}

module.exports = {runTests};