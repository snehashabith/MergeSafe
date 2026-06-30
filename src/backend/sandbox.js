const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function createSandbox(options = {}) {
    const sandboxId = `smart-test-${Date.now()}`;
    const currentDir = path.join(os.tmpdir(), sandboxId, 'current');
    const incomingDir = path.join(os.tmpdir(), sandboxId, 'incoming');

    await fs.ensureDir(currentDir);
    await fs.ensureDir(incomingDir);

    if (options.nodeModulesDir && await fs.pathExists(options.nodeModulesDir)) {
        await fs.ensureSymlink(options.nodeModulesDir, path.join(currentDir, 'node_modules'), 'junction');
        await fs.ensureSymlink(options.nodeModulesDir, path.join(incomingDir, 'node_modules'), 'junction');
    }

    console.log(`Sandbox created with ID: ${sandboxId}`);
    

    return { currentDir, incomingDir, sandboxId };
}

module.exports = { createSandbox };
