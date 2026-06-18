const {exec} = require('child_process');

function runTests(directory){
    return new Promise((resolve) => {
        exec('npm run test',{cwd:directory}, (error, stdout, stderr) => {
            const rawLogs= stderr || stdout || '';
            resolve({
                passed: !error,
                logs: rawLogs
            });
        });
    });
}

module.exports = {runTests};