const fs = require('fs-extra');
const path = require('path');

async function splitFile(sourcePath, currentDest, incomingDest) {
    const fileContent = await fs.readFile(sourcePath, 'utf8');

    const currentClean = fileContent.replace(/<<<<<<<[\s\S]*?\n([\s\S]*?)=======[\s\S]*?>>>>>>>.*/g, '$1');
    const incomingClean = fileContent.replace(/<<<<<<<[\s\S]*?=======([\s\S]*?)\n>>>>>>>.*/g, '$1');

    await fs.writeFile(path.join(currentDest, 'resolved.js'), currentClean);
    await fs.writeFile(path.join(incomingDest, 'resolved.js'), incomingClean);
}

module.exports = { splitFile };