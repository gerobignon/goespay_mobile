import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * L'affiche d'un lien de paiement, rendue en PNG carré par le backend
 * (`/pay/<code>/affiche.png`).
 *
 * POURQUOI LE SERVEUR : l'affiche doit être identique sur l'app, le web et dans
 * l'aperçu du lien partagé (og:image). Une seule composition, côté backend, au
 * lieu d'un rendu par plateforme qui diverge au premier changement de maquette.
 */

/** URL de l'affiche. `dl` force le téléchargement plutôt que l'affichage. */
export function posterImageUrl(linkUrl: string, lang: string, dl = false): string {
  return `${linkUrl}/affiche.png?lang=${lang}${dl ? '&dl=1' : ''}`;
}

/**
 * Remet l'affiche à l'utilisateur.
 * - Web : ouvre l'URL en pièce jointe (`Content-Disposition: attachment`) — un
 *   `<a download>` serait ignoré, l'image venant d'une autre origine que la PWA.
 * - Natif : télécharge dans le cache puis ouvre la feuille de partage, d'où
 *   « Enregistrer l'image » et l'envoi direct vers WhatsApp.
 */
export async function downloadPoster(
  linkUrl: string,
  code: string,
  lang: string,
  dialogTitle: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    // Ouverture DANS le geste utilisateur : Safari bloque silencieusement une
    // fenêtre ouverte après un await (même piège que downloadPdf).
    if (typeof window !== 'undefined') {
      window.open(posterImageUrl(linkUrl, lang, true), '_blank');
    }
    return;
  }

  const fileUri = `${FileSystem.cacheDirectory}goespay-${code.toLowerCase()}.png`;
  const { uri } = await FileSystem.downloadAsync(posterImageUrl(linkUrl, lang), fileUri);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle,
      UTI: 'public.png',
    });
  }
}
