// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add extra node modules resolution for native modules
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  // Empty modules for Node.js built-ins not available in React Native
  crypto: require.resolve('react-native-get-random-values'),
  stream: require.resolve('stream-browserify'),
};

// Ensure axios uses the browser version instead of Node.js version
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Force axios to use browser build which doesn't require crypto
  if (moduleName === 'axios' && platform !== 'web') {
    return {
      filePath: require.resolve('axios/dist/browser/axios.cjs'),
      type: 'sourceFile',
    };
  }
  // Default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
