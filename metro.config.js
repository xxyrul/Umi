const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Block native build files from being watched by Metro to prevent crashes
config.resolver.blockList = [
  /.*\/android\/build\/.*/,
  /.*\/ios\/build\/.*/,
];

module.exports = config;
