// Nom et prénom : lettres latines (accents compris), espaces et traits d'union.
// Même règle que le serveur (helpers/PersonName.php) : l'émetteur de cartes
// refuse tout nom qui porte un chiffre, une apostrophe ou un symbole.
const DISALLOWED = /[^A-Za-zÀ-ÖØ-öø-ɏ \-]/g;

/** Retire à la frappe tout caractère refusé. */
export function sanitizePersonNameInput(value: string): string {
  return value.replace(DISALLOWED, '');
}
