import { downloadPdf } from './pdfDownload';

/**
 * Télécharge le relevé de compte PDF officiel généré côté backend pour la
 * période [from, to] (dates au format YYYY-MM-DD). Le titre de la feuille de
 * partage vient de l'appelant (i18n).
 */
export async function downloadStatement(from: string, to: string, shareTitle: string): Promise<void> {
  await downloadPdf(
    'wallet/statement',
    `goespay_releve_${from}_${to}.pdf`,
    shareTitle,
    { from, to, format: 'pdf' },
  );
}
