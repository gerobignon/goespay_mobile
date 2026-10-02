// Release builds already run R8, but the Expo template loads
// proguard-android.txt, which carries -dontoptimize: code is shrunk and
// obfuscated, never optimized (Play Console flags it). Switch to the
// optimizing default file.
const { withAppBuildGradle } = require('expo/config-plugins');

const FROM = 'getDefaultProguardFile("proguard-android.txt")';
const TO = 'getDefaultProguardFile("proguard-android-optimize.txt")';

module.exports = function withR8Optimize(config) {
  return withAppBuildGradle(config, (cfg) => {
    const gradle = cfg.modResults.contents;
    if (!gradle.includes(TO)) {
      if (!gradle.includes(FROM)) {
        throw new Error('withR8Optimize: proguardFiles line not found in app/build.gradle');
      }
      cfg.modResults.contents = gradle.replace(FROM, TO);
    }
    return cfg;
  });
};
