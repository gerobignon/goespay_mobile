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
 * - Web : clic sur un `<a>` vers l'URL en pièce jointe (`Content-Disposition:
 *   attachment`). PAS `window.open` : en PWA installée (standalone iOS) une
 *   fenêtre nommée est bloquée SILENCIEUSEMENT — « rien ne se passe » au clic.
 *   L'attribut `download` est ignoré (image d'une autre origine que la PWA),
 *   c'est l'en-tête serveur qui déclenche le téléchargement ; en standalone on
 *   omet aussi `target` pour éviter le même blocage.
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
    if (typeof document === 'undefined') return;

    const url = posterImageUrl(linkUrl, lang, true);
    const standalone =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true);

    const a = document.createElement('a');
    a.href = url;
    a.download = `goespay-${code.toLowerCase()}.png`;
    a.rel = 'noopener';
    if (!standalone) a.target = '_blank';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
