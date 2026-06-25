const {exec} = require('child_process');

function runTests(directory){
    return new Promise((resolve) => {
        exec('npm run test --',{cwd:directory, maxBuffer: 1024 * 1024* 2 }, (error, stdout, stderr) => {
            const rawLogs= stderr || stdout || '';
            if (error && rawLogs.includes("FAIL") && !rawLogs.includes("Test")){
                return resolve({
                    passed: false,
                    logs:'error: ${error.message}'
                });
            }
            resolve({
                passed: error=== null,
                logs: rawLogs
            });
        });
    });
}

module.exports = {runTests};