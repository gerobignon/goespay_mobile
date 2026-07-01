import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import api from '../services/api';

export type InvoiceType = 'deposit' | 'withdraw' | 'crypto';

/**
 * Télécharge la facture PDF officielle GoesPay générée côté backend.
 * - Sur web : déclenche un téléchargement via blob URL.
 * - Sur natif : sauvegarde dans le cache puis ouvre la feuille de partage.
 */
export async function downloadInvoice(type: InvoiceType, id: number | string): Promise<void> {
  const path = `transaction/${type}/${id}/invoice`;

  if (Platform.OS === 'web') {
    // Safari bloque SILENCIEUSEMENT un téléchargement / window.open déclenché APRÈS
    // un `await` (hors du geste utilisateur) → « rien ne se passe » au clic. On
    // pré-ouvre l'onglet DANS le geste (même pattern que la fenêtre carte du dépôt),
    // puis on y pointe le PDF une fois le blob récupéré.
    const win = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    try {
      const response = await api.get(path, { responseType: 'blob' });
      const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      if (win) {
        // Onglet pré-ouvert (Safari-safe) → affiche le PDF.
        win.location.href = url;
      } else {
        // Pas de fenêtre (bloqueur de popup) → repli téléchargement classique.
        const a = document.createElement('a');
        a.href = url;
        a.download = `goespay_${type}_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      // Laisse le temps au PDF de charger dans l'onglet avant de révoquer l'URL.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      if (win) win.close();
      throw e;
    }
    return;
  }

  const response = await api.get(path, { responseType: 'arraybuffer' });
  const base64 = arrayBufferToBase64(response.data as ArrayBuffer);

  const fileUri = `${FileSystem.cacheDirectory}goespay_${type}_${id}.pdf`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/pdf',
      dialogTitle: `Facture GoesPay #${id}`,
      UTI: 'com.adobe.pdf',
    });
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  if (typeof btoa === 'function') return btoa(binary);
  // Fallback Buffer (shouldn't normally hit on RN)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('buffer').Buffer.from(binary, 'binary').toString('base64');
}
