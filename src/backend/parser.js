//need to be fixed since there is issue in json output
function parseTestLogs(rawLogs) {
    console.log(rawLogs);
    if (!rawLogs || rawLogs.trim() === "") {
        return { message: 'All tests passed cleanly.', failedFile: null, failedLine: null };
    }

    const lineMatchRegex = /at\s+([^\s]+)\s+\(([^)]+):(\d+):(\d+)\)/;
    const match = rawLogs.match(lineMatchRegex);

    if (match) {
        return {
            message: "Build Failure Detected",
            failedFile: match[2],     // Extracts filename
            failedLine: parseInt(match[3]) // Extracts exact line number 
        };
    }

    return { message: 'Build error occurred, but location tracing was inconclusive.', failedFile: null, failedLine: null };
}

module.exports = { parseTestLogs };