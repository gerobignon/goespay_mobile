// Regroupement géographique des pays par continent pour le sélecteur d'envoi.
// GoesPay n'a AUCUNE donnée continent côté serveur (le seul regroupement est la
// zone-devise CFA XOF/XAF). On dérive donc le continent du code ISO-2 ici.

// Océanie retirée : ses pays (Australie, NZ…) sont repliés dans l'Asie-Pacifique
// pour ne pas devenir inaccessibles.
export type Continent = 'africa' | 'europe' | 'america' | 'asia';

// Ordre d'affichage + libellé/description via t('continents.<key>.*').
// `image` = silhouette du continent (PNG monochrome, tintée à la couleur du
// thème via tintColor). `icon` = repli FontAwesome6 (earth-*) tant qu'aucune
// silhouette n'est fournie. Metro exige des require() statiques → map en dur.
export const CONTINENTS: { key: Continent; icon: string; image?: number }[] = [
  { key: 'africa', icon: 'earth-africa', image: require('../../assets/continents/africa.png') },
  { key: 'europe', icon: 'earth-europe', image: require('../../assets/continents/europe.png') },
  { key: 'america', icon: 'earth-americas', image: require('../../assets/continents/america.png') },
  { key: 'asia', icon: 'earth-asia', image: require('../../assets/continents/asia.png') },
];

// Pays « populaires » mis en avant en tête de liste (par continent). Intersecté
// avec les pays réellement disponibles à l'envoi → la section se masque si vide.
export const POPULAR_BY_CONTINENT: Record<Continent, string[]> = {
  africa: ['CI', 'SN', 'CM', 'BJ', 'GH', 'NG', 'ML', 'BF', 'TG', 'GA', 'CD', 'CG'],
  europe: ['FR', 'BE', 'DE', 'IT', 'ES', 'GB', 'PT', 'NL'],
  america: ['US', 'CA', 'BR'],
  asia: ['CN', 'IN', 'AE', 'AU'],
};

// Codes ISO-2 par continent (couverture large ; seuls les pays réellement servis
// apparaîtront de toute façon).
const AFRICA = [
  'DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD', 'KM', 'CG', 'CD',
  'CI', 'DJ', 'EG', 'GQ', 'ER', 'SZ', 'ET', 'GA', 'GM', 'GH', 'GN', 'GW', 'KE',
  'LS', 'LR', 'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG',
  'RW', 'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'TZ', 'TG', 'TN', 'UG',
  'ZM', 'ZW', 'EH', 'YT', 'RE',
];
const EUROPE = [
  'AL', 'AD', 'AT', 'BY', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI',
  'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'XK', 'LV', 'LI', 'LT', 'LU', 'MT',
  'MD', 'MC', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'RU', 'SM', 'RS', 'SK',
  'SI', 'ES', 'SE', 'CH', 'UA', 'GB', 'VA', 'GI', 'FO', 'AX', 'GG', 'JE', 'IM',
];
const AMERICA = [
  'AG', 'AR', 'AW', 'BS', 'BB', 'BZ', 'BO', 'BR', 'CA', 'KY', 'CL', 'CO', 'CR',
  'CU', 'DM', 'DO', 'EC', 'SV', 'GL', 'GD', 'GT', 'GY', 'HT', 'HN', 'JM', 'MX',
  'NI', 'PA', 'PY', 'PE', 'PR', 'KN', 'LC', 'VC', 'SR', 'TT', 'US', 'UY', 'VE',
  'BM', 'GP', 'MQ', 'BL', 'MF', 'BQ', 'CW', 'SX', 'VG', 'VI', 'AI', 'MS', 'TC',
  'FK', 'GF',
];
// Asie-Pacifique : inclut l'Océanie (Australie, NZ, îles du Pacifique) repliée
// ici puisqu'il n'y a plus de continent Océanie séparé.
const ASIA = [
  'AF', 'AM', 'AZ', 'BH', 'BD', 'BT', 'BN', 'KH', 'CN', 'GE', 'HK', 'IN', 'ID',
  'IR', 'IQ', 'IL', 'JP', 'JO', 'KZ', 'KW', 'KG', 'LA', 'LB', 'MO', 'MY', 'MV',
  'MN', 'MM', 'NP', 'KP', 'OM', 'PK', 'PH', 'QA', 'SA', 'SG', 'KR', 'LK', 'SY',
  'TW', 'TJ', 'TH', 'TL', 'TR', 'TM', 'AE', 'UZ', 'VN', 'YE', 'PS',
  'AU', 'FJ', 'PF', 'GU', 'KI', 'MH', 'FM', 'NR', 'NC', 'NZ', 'NU', 'PW', 'PG',
  'WS', 'SB', 'TO', 'TV', 'VU', 'WF', 'CK', 'AS', 'MP',
];

const CONTINENT_BY_ISO2: Record<string, Continent> = (() => {
  const map: Record<string, Continent> = {};
  const add = (codes: string[], c: Continent) => codes.forEach((code) => { map[code] = c; });
  add(AFRICA, 'africa');
  add(EUROPE, 'europe');
  add(AMERICA, 'america');
  add(ASIA, 'asia');
  return map;
})();

// Continent d'un pays (ISO-2). Repli 'africa' pour un code inconnu (GoesPay est
// centré Afrique ; un code non mappé est extrêmement improbable).
export function continentOf(code: string): Continent {
  return CONTINENT_BY_ISO2[(code || '').toUpperCase()] ?? 'africa';
}
