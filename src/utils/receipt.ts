import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatCurrency, formatDate } from './format';
import type { Transaction } from '../types';

interface ReceiptRow {
  label: string;
  value: string;
}

function buildRows(tx: Transaction, type: 'deposit' | 'withdraw' | 'transfer'): ReceiptRow[] {
  const rows: ReceiptRow[] = [
    { label: 'Transaction ID', value: `#${tx.id}` },
    { label: 'Type', value: type === 'deposit' ? 'Dépôt' : type === 'withdraw' ? 'Retrait' : 'Transfert' },
    { label: 'Statut', value: 'Succès' },
  ];

  if (type === 'withdraw' || type === 'transfer') {
    rows.push({ label: 'Montant total', value: `${formatCurrency(tx.amount)} XOF` });
    if (tx.amount_sent != null && tx.amount_sent !== tx.amount) {
      rows.push({ label: 'Montant envoyé', value: `${formatCurrency(tx.amount_sent)} XOF` });
      rows.push({ label: 'Frais', value: `${formatCurrency(tx.amount - tx.amount_sent)} XOF` });
    }
  } else {
    rows.push({ label: 'Montant', value: `${formatCurrency(tx.amount)} XOF` });
  }

  if (tx.mode) rows.push({ label: 'Mode', value: tx.mode });
  if (tx.de) rows.push({ label: 'De', value: tx.de });
  if (tx.phone) rows.push({ label: 'Destinataire', value: tx.phone });
  if (tx.receiver_name) rows.push({ label: 'Destinataire', value: tx.receiver_name });
  if (tx.receiver_email) rows.push({ label: 'Email', value: tx.receiver_email });
  if (tx.reference) rows.push({ label: 'Référence', value: tx.reference });
  if (tx.avant != null) rows.push({ label: 'Solde avant', value: `${formatCurrency(tx.avant)} XOF` });
  if (tx.apres != null) rows.push({ label: 'Solde après', value: `${formatCurrency(tx.apres)} XOF` });

  rows.push({ label: 'Date', value: formatDate(tx.created_at) });
  if (tx.updated_at && tx.updated_at !== tx.created_at) {
    rows.push({ label: 'Date de validation', value: formatDate(tx.updated_at) });
  }

  return rows;
}

export async function shareReceipt(tx: Transaction, type: 'deposit' | 'withdraw' | 'transfer') {
  const rows = buildRows(tx, type);
  const typeLabel = type === 'deposit' ? 'Dépôt' : type === 'withdraw' ? 'Retrait' : 'Transfert';

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, sans-serif; padding: 40px 30px; color: #1a1a2e; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: 800; color: #3176FE; }
          .subtitle { font-size: 14px; color: #888; margin-top: 4px; }
          .amount-box { text-align: center; margin: 20px 0 30px; }
          .amount { font-size: 36px; font-weight: 800; color: #1a1a2e; }
          .currency { font-size: 14px; color: #888; letter-spacing: 2px; }
          .badge { display: inline-block; background: #3176FE20; color: #3176FE; padding: 6px 20px; border-radius: 20px; font-weight: 700; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          td { padding: 12px 0; font-size: 14px; border-bottom: 1px solid #eee; }
          td.label { color: #888; width: 45%; }
          td.value { color: #1a1a2e; font-weight: 600; text-align: right; }
          .footer { text-align: center; margin-top: 40px; font-size: 11px; color: #aaa; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">GOESPAY</div>
          <div class="subtitle">Reçu de ${typeLabel}</div>
        </div>
        <div style="text-align:center"><span class="badge">✓ Succès</span></div>
        <div class="amount-box">
          <div class="amount">${formatCurrency(tx.amount)}</div>
          <div class="currency">XOF</div>
        </div>
        <table>
          ${rows.map((r) => `<tr><td class="label">${r.label}</td><td class="value">${r.value}</td></tr>`).join('')}
        </table>
        <div class="footer">GoesPay — Reçu généré le ${new Date().toLocaleDateString('fr-FR')}</div>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Reçu ${typeLabel} #${tx.id}`,
    UTI: 'com.adobe.pdf',
  });
}
