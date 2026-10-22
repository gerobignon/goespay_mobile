// Nom et prénom : lettres latines (accents compris), espaces et traits d'union.
// Même règle que le serveur (helpers/PersonName.php) : l'émetteur de cartes
// refuse tout nom qui porte un chiffre, une apostrophe ou un symbole.
const DISALLOWED = /[^A-Za-zÀ-ÖØ-öø-ɏ \-]/g;

/** Retire à la frappe tout caractère refusé. */
export function sanitizePersonNameInput(value: string): string {
  return value.replace(DISALLOWED, '');
}

/** « Géraud » → « GERAUD » : comparaison sans accents ni casse. */
function fold(word: string): string {
  try {
    return word.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  } catch {
    return word.toUpperCase();
  }
}

/**
 * Nom lu sur la pièce, souvent imprimé sans accents : un mot déjà connu à
 * l'identique hors accents reprend ses accents, avec la casse de la pièce.
 * « Geraud Romeo » + « Géraud » → « Géraud Romeo ».
 */
export function withKnownAccents(read: string, known: string): string {
  const spelled: Record<string, string> = {};
  for (const w of known.split(/[\s-]+/)) if (w) spelled[fold(w)] = w;
  return read.replace(/[^\s-]+/g, (w) => {
    const k = spelled[fold(w)];
    if (!k || k.length !== w.length) return w;
    return w.split('').map((c, i) => (c === c.toUpperCase() ? k[i].toUpperCase() : k[i].toLowerCase())).join('');
  });
}
