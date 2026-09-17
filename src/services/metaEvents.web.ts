/**
 * Variante web de `metaEvents` : le SDK Meta est natif, la PWA ne mesure rien.
 * Les signatures restent identiques pour que les écrans partagés compilent.
 */
export function initMetaEvents(): void {}

export function logSignUp(_method: string): void {}

export function logDepositStarted(_amountXof: number, _operator: string): void {}

export function logDepositCompleted(_amountXof: number, _operator: string): void {}
