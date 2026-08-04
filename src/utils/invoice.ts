import { downloadPdf } from './pdfDownload';

export type InvoiceType = 'deposit' | 'withdraw' | 'crypto';

/**
 * Télécharge la facture PDF officielle GoesPay générée côté backend.
 */
export async function downloadInvoice(type: InvoiceType, id: number | string): Promise<void> {
  await downloadPdf(
    `transaction/${type}/${id}/invoice`,
    `goespay_${type}_${id}.pdf`,
    `Facture GoesPay #${id}`,
  );
}
