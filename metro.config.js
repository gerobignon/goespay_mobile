const { getDefaultConfig } = require('expo/metro-config');

// Régénère les traductions natives (iOS et Android) avant tout bundling (Metro charge ce fichier au
// démarrage, y compris pendant un build EAS). Les libellés d'achat et de vente
// de crypto-monnaies sont ainsi toujours absents des binaires, même si
// quelqu'un oublie de rejouer le script après avoir touché aux traductions.
require('./scripts/gen-native-locales');

module.exports = getDefaultConfig(__dirname);
