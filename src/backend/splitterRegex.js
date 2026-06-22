const fs = require('fs-extra');
const path = require('path');

async function splitFile(sourcePath, currentDest, incomingDest) {
    const fileContent = await fs.readFile(sourcePath, 'utf8');

    const parts = fileContent.split(/<<<<<<< HEAD\r?\n|=======\r?\n|>>>>>>> .*\r?\n/);

    if (parts.length >= 4) {
        const beforeConflict = parts[0];
        const currentChange  = parts[1];
        const incomingChange = parts[2];
        const afterConflict  = parts[3];

        const currentClean = beforeConflict + currentChange + afterConflict;
        const incomingClean = beforeConflict + incomingChange + afterConflict;

        console.log('Current Version:\n', currentClean);
        console.log('Incoming Version:\n', incomingClean);

        await fs.writeFile(path.join(currentDest, 'resolved.js'), currentClean);
        await fs.writeFile(path.join(incomingDest, 'resolved.js'), incomingClean);

        console.log('Files have been split and saved to the respective directories.');
    }
    else {
        console.error('No merge conflict markers found in the file.');
    }
}

module.exports = { splitFile };