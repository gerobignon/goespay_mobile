/**
 * Codes considérés comme stables tant que `/config` n'a pas répondu.
 *
 * Isolés ici pour que la variante `stablecoinDefaults.ios.ts` les retire du
 * bundle iOS : le binaire iOS n'offre aucun service d'échange de
 * crypto-monnaies (règle App Store 3.1.5(iii)) et n'a donc à en nommer aucune.
 */
export const STABLECOIN_CODES = ['PM', 'PAYEER', 'USDT.TRC20', 'BUSD.BEP20', 'USDT', 'BUSD'];
