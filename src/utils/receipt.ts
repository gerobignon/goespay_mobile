import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatXof, formatDate, currentCurrencyCode } from './format';
import { resolveOperatorDisplay } from './operatorDisplay';
import type { Transaction } from '../types';

interface ReceiptRow {
  label: string;
  value: string;
}

function buildRows(tx: Transaction, type: 'deposit' | 'withdraw' | 'transfer' | 'crypto'): ReceiptRow[] {
  const rows: ReceiptRow[] = [
    { label: 'Transaction ID', value: `#${tx.id}` },
    {
      label: 'Type',
      value: type === 'deposit' ? 'Dépôt' : type === 'withdraw' ? 'Envoi' : type === 'transfer' ? 'Envoi' : (tx.mode === 'Buy' ? 'Achat de monnaie numérique' : 'Vente de monnaie numérique'),
    },
    { label: 'Statut', value: 'Succès' },
  ];

  if (type === 'crypto') {
    rows.push({ label: 'Montant payé', value: formatXof(tx.amount) });
    if (tx.dollar != null) rows.push({ label: 'Quantité crypto', value: `${tx.dollar} ${tx.currency_src ?? ''}`.trim() });
    if (tx.currency_src) rows.push({ label: 'Monnaie numérique', value: tx.currency_src });
    if (tx.address) rows.push({ label: 'Adresse portefeuille', value: tx.address });
    if (tx.cp_hash) rows.push({ label: 'Hash transaction', value: tx.cp_hash });
  } else if (type === 'withdraw' || type === 'transfer') {
    // Retrait Fincra : amount = XOF débité (total), amount_sent = livré en
    // currency_dest (NGN/GHS/…), fee_xof = frais GoesPay (XOF). On n'additionne
    // ni ne soustrait JAMAIS deux devises différentes.
    const isFincraTx = (!!tx.currency_dest && tx.currency_dest !== 'XOF')
      || !!(tx.mode && tx.mode.startsWith('fincra-'));
    rows.push({ label: 'Total débité', value: formatXof(tx.amount) });
    if (isFincraTx) {
      if (tx.currency_dest && tx.amount_sent != null) {
        const fmtDest = (n: number) =>
          `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${tx.currency_dest}`;
        rows.push({ label: 'Le bénéficiaire reçoit', value: fmtDest(tx.amount_sent) });
      }
      if (tx.fee_xof != null && tx.fee_xof !== 0) {
        rows.push({ label: 'Frais', value: formatXof(tx.fee_xof) });
      }
    } else if (tx.amount_sent != null && tx.amount_sent !== tx.amount) {
      rows.push({ label: 'Montant envoyé', value: formatXof(tx.amount_sent) });
      rows.push({ label: 'Frais', value: formatXof(Math.max(0, tx.amount - tx.amount_sent)) });
    }
  } else {
    rows.push({ label: 'Montant', value: formatXof(tx.amount) });
  }

  // Libellé propre (jamais la string brute « fincra-… » / « klasha-mm-… ») :
  // résolveur commun partagé avec l'historique/détail (opérateur précis, rail,
  // catalogue). Repli sur le code brut seulement si non résolu.
  const cleanMode = (mode?: string) => {
    if (!mode) return '';
    const disp = resolveOperatorDisplay(mode);
    if (disp && disp.name && disp.name !== mode) {
      return `${disp.flag ? disp.flag + ' ' : ''}${disp.name}`.trim();
    }
    return mode;
  };

  if (type !== 'crypto') {
    if (tx.mode) rows.push({ label: 'Mode', value: cleanMode(tx.mode) });
    if (tx.de) rows.push({ label: 'De', value: tx.de });
    if (tx.phone) rows.push({ label: 'Destinataire', value: tx.phone });
    if (tx.receiver_name) rows.push({ label: 'Destinataire', value: tx.receiver_name });
    if (tx.receiver_email) rows.push({ label: 'Email', value: tx.receiver_email });
    if (tx.reference) rows.push({ label: 'Référence', value: tx.reference });
    if (tx.avant != null) rows.push({ label: 'Solde avant', value: formatXof(tx.avant) });
    if (tx.apres != null) rows.push({ label: 'Solde après', value: formatXof(tx.apres) });
  } else {
    if (tx.avant != null) rows.push({ label: 'Solde avant', value: formatXof(tx.avant) });
    if (tx.apres != null) rows.push({ label: 'Solde après', value: formatXof(tx.apres) });
  }

  rows.push({ label: 'Date', value: formatDate(tx.created_at) });
  if (tx.updated_at && tx.updated_at !== tx.created_at) {
    rows.push({ label: 'Date de validation', value: formatDate(tx.updated_at) });
  }

  return rows;
}

export async function shareReceipt(tx: Transaction, type: 'deposit' | 'withdraw' | 'transfer' | 'crypto') {
  const rows = buildRows(tx, type);
  const typeLabel =
    type === 'deposit' ? 'Dépôt' :
    type === 'withdraw' ? 'Envoi' :
    type === 'transfer' ? 'Envoi' :
    (tx.mode === 'Buy' ? 'Achat crypto' : 'Vente crypto');

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
          <div class="amount">${formatXof(tx.amount, { withCode: false })}</div>
          <div class="currency">${currentCurrencyCode()}</div>
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
