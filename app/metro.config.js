// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// @supabase/supabase-js v2 optionally loads @opentelemetry/api via a dynamic
// import guarded by `.catch(() => null)`. Metro doesn't honor the bundler-ignore
// hints on that import and tries to resolve it statically, which fails because the
// package is optional and not installed. Stub it to an empty module — the runtime
// catch handles its absence.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@opentelemetry/api") {
    return { type: "empty" };
  }
  return (originalResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
