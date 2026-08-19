// Configuration Metro pour un dépôt en monorepo :
// l'application vit dans apps/mobile mais importe packages/core.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Surveiller aussi les fichiers du workspace (pour le rechargement à chaud).
config.watchFolders = [workspaceRoot];

// 2. Chercher les modules dans les deux node_modules, celui de l'app d'abord.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Ne pas remonter au-delà du workspace.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
