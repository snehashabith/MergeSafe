
function parseTestLogs(rawLogs) {
    if (!rawLogs) return { message: 'Clear', location: null };

    const lineMatchRegex = /at\s+([^\s]+)\s+\(([^)]+):(\d+):(\d+)\)/;
    const match = rawLogs.match(lineMatchRegex);

    if (match) {
        return {
            message: "Build Failure Detected",
            failedFile: match[2],     // Extracts filename
            failedLine: parseInt(match[3]) // Extracts exact line number 
        };
    }

    return { message: 'Build error occurred, but location tracing was inconclusive.', location: null };
}

module.exports = { parseTestLogs };