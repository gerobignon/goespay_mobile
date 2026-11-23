import { downloadPdf } from './pdfDownload';

/** Type de transaction facturable ; les extensions (src/addons) passent le leur. */
export type InvoiceType = 'deposit' | 'withdraw' | (string & {});

/**
 * Télécharge la facture PDF officielle GOESPAY générée côté backend.
 */
export async function downloadInvoice(type: InvoiceType, id: number | string): Promise<void> {
  await downloadPdf(
    `transaction/${type}/${id}/invoice`,
    `goespay_${type}_${id}.pdf`,
    `Facture GOESPAY #${id}`,
  );
}
