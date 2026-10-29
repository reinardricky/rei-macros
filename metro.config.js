// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The Anthropic SDK's ES-module build has a circular re-export
// (resources/beta/messages <-> lib/tools/BetaToolRunner) that Metro evaluates
// in the wrong order, crashing with "Cannot read property 'BetaToolRunner' of
// undefined". Its CommonJS build reads those exports lazily, so resolve the SDK
// as if it were `require()`d.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@anthropic-ai/sdk' || moduleName.startsWith('@anthropic-ai/sdk/')) {
    return context.resolveRequest({ ...context, isESMImport: false }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
