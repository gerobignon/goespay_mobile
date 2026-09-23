const { getDefaultConfig } = require('expo/metro-config');

// Régénère les traductions iOS avant tout bundling (Metro charge ce fichier au
// démarrage, y compris pendant un build EAS). Les libellés d'achat et de vente
// de crypto-monnaies sont ainsi toujours absents du binaire iOS, même si
// quelqu'un oublie de rejouer le script après avoir touché aux traductions.
require('./scripts/gen-ios-locales');

module.exports = getDefaultConfig(__dirname);
