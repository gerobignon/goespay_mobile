#!/usr/bin/env node
/**
 * Garde-fou du build web : la page publique ne doit rien contenir du service
 * crypto.
 *
 * Tout visiteur, robots publicitaires compris (Meta refuse les annonces d'un
 * site qui propose de la crypto), charge les fichiers JS que référence
 * `index.html`. Le service crypto vit dans un fichier à part, chargé après la
 * connexion (voir `src/addons/boot.ts`). Ce script vérifie, après
 * `expo export`, que rien n'en a fui dans les fichiers publics ni dans le
 * manifeste PWA.
 *
 * Usage : node scripts/check-web-bundle.js [dossier d'export, défaut dist]
 * Code de retour ≠ 0 si une fuite est trouvée (le déploiement doit s'arrêter).
 */
const fs = require('fs');
const path = require('path');

const dist = path.resolve(process.argv[2] || 'dist');

/** Marqueurs propres au service crypto : aucune occurrence tolérée. */
const MARKERS = [
  /nowpayments/i,
  /coinpayments/i,
  /stablecoin/i,
  /assets\/crypto\//i,
  /\/user\/wallets/i,
  /monnaie num/i,
];

/**
 * Le mot « crypto » est toléré seulement dans ces contextes, étrangers au
 * service : API Web Crypto du navigateur (identifiants, hachage du PIN), CVV
 * (« cryptogramme ») et liste des codes de parrainage réservés.
 */
const CRYPTO_ALLOWED = [
  /\.crypto\b/,
  /typeof crypto\b/,
  /\bcrypto\.(subtle|getRandomValues|randomUUID)\b/,
  /node:crypto/,
  /BROWSER_CRYPTO/,
  /support crypto\./,
  /cryptogramme/i,
  /'CRYPTO','KYC'/,
];

function publicScripts() {
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  return [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]);
}

const leaks = [];
const context = (s, i, len) => s.slice(Math.max(0, i - 50), i + len + 50).replace(/\s+/g, ' ');

for (const src of publicScripts()) {
  const file = path.join(dist, src.replace(/^\//, ''));
  const code = fs.readFileSync(file, 'utf8');

  for (const re of MARKERS) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    for (const m of code.matchAll(g)) leaks.push(`${src} : ${context(code, m.index, m[0].length)}`);
  }
  for (const m of code.matchAll(/crypto(?!gramm)/gi)) {
    const around = context(code, m.index, m[0].length);
    if (!CRYPTO_ALLOWED.some((re) => re.test(around))) leaks.push(`${src} : ${around}`);
  }
}

const manifestPath = path.join(dist, 'manifest.json');
if (fs.existsSync(manifestPath) && /crypto|bitcoin|usdt/i.test(fs.readFileSync(manifestPath, 'utf8'))) {
  leaks.push('manifest.json : la description mentionne la crypto');
}

if (leaks.length) {
  console.error(`✗ Le service crypto a fui dans la page publique (${leaks.length}) :`);
  leaks.slice(0, 20).forEach((l) => console.error(`  ▸ ${l}`));
  console.error('Le code crypto ne doit être atteint que par src/addons/installed.ts (import dynamique).');
  process.exit(1);
}
console.log(`✓ Page publique sans service crypto (${publicScripts().join(', ')}).`);
