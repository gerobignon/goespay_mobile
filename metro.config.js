const { getDefaultConfig } = require('expo/metro-config');

// Régénère les traductions dérivées (web, module crypto, natif) avant tout
// bundling (Metro charge ce fichier au démarrage, y compris pendant un build
// EAS). Les libellés crypto restent ainsi hors de la page publique et des
// binaires, même si quelqu'un oublie de rejouer le script après avoir touché
// aux traductions. Voir scripts/gen-locales.js.
require('./scripts/gen-locales');

module.exports = getDefaultConfig(__dirname);
