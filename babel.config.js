module.exports = function (api) {
  // Detect the target platform and cache the resulting config per-platform so
  // the web-only downleveling below is applied to web bundles but never to the
  // native (Hermes) bundle. This mirrors how `babel-preset-expo` reads the
  // caller platform.
  const platform = api.caller((caller) => (caller ? caller.platform : null));
  api.cache.using(() => platform);
  const isWeb = platform === 'web';

  // Expo SDK 54's WEB Babel preset (`babel-preset-expo` -> `web-preset`) targets
  // "modern" browsers and does NOT transpile optional chaining (`?.`), nullish
  // coalescing (`??`), logical assignment (`??=`/`||=`/`&&=`), class fields
  // (`state = {}`) or numeric separators (`1_000`). Older mobile browsers
  // (iOS < 14.5, legacy Android WebView/Chrome) then fail to *parse* the web
  // bundle with a `SyntaxError` -> blank/black screen. We re-add those syntax
  // transforms for web only.
  //
  // NOTE: declared as a PRESET placed first in the list so that, per Babel's
  // reverse preset ordering, it runs AFTER `babel-preset-expo` — i.e. after
  // Flow/TypeScript types have been stripped. This respects the documented
  // "flow strip types must run before class properties" constraint.
  const legacyWebSyntax = () => ({
    plugins: [
      require('@babel/plugin-transform-optional-chaining'),
      require('@babel/plugin-transform-nullish-coalescing-operator'),
      require('@babel/plugin-transform-logical-assignment-operators'),
      // `loose: true` must match `babel-preset-expo`'s web-preset, which enables
      // transform-private-methods / -private-property-in-object in loose mode.
      // Babel errors if these three plugins disagree on `loose`.
      [require('@babel/plugin-transform-class-properties'), { loose: true }],
      require('@babel/plugin-transform-numeric-separator'),
    ],
  });

  return {
    presets: [
      ...(isWeb ? [legacyWebSyntax] : []),
      'babel-preset-expo',
    ],
    env: {
      production: {
        plugins: [
          ['transform-remove-console', { exclude: ['error', 'warn'] }],
        ],
      },
    },
  };
};
