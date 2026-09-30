/**
 * Codes considérés comme stables tant que `/config` n'a pas répondu.
 *
 * Isolés ici pour que la variante `stablecoinDefaults.native.ts` les retire des
 * bundles iOS et Android : les apps natives n'offrent aucun service d'échange
 * de crypto-monnaies et n'ont donc à en nommer aucune.
 */
export const STABLECOIN_CODES = ['PM', 'PAYEER', 'USDT.TRC20', 'BUSD.BEP20', 'USDT', 'BUSD'];
