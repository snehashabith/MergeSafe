const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function createSandbox() {
    const sandboxId = `smart-test-${Date.now()}`;
    const currentDir = path.join(os.tmpdir(), sandboxId, 'current');
    const incomingDir = path.join(os.tmpdir(), sandboxId, 'incoming');

    await fs.ensureDir(currentDir);
    await fs.ensureDir(incomingDir);

    // Dynamic node_modules symlinking
    const projectModules = path.join(__dirname, '..', '..', 'node_modules');
    await fs.ensureSymlink(projectModules, path.join(currentDir, 'node_modules'));
    await fs.ensureSymlink(projectModules, path.join(incomingDir, 'node_modules'));

    console.log(`Sandbox created with ID: ${sandboxId}`);
    

    return { currentDir, incomingDir, sandboxId };
}

module.exports = { createSandbox };