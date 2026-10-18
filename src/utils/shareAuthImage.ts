import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import api from '../services/api';
import { SafeStorage } from '../services/storage';

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Partage une image servie derrière le jeton (route API protégée).
 * - Natif : téléchargée dans le cache avec l'en-tête Bearer, puis feuille de
 *   partage (WhatsApp, « Enregistrer l'image »…).
 * - Web : binaire récupéré par axios ; partage de fichier du navigateur quand il
 *   existe (mobile), sinon téléchargement du blob.
 */
export async function shareAuthImage(uri: string, baseName: string, dialogTitle: string): Promise<void> {
  if (Platform.OS === 'web') {
    const res = await api.get(uri, { responseType: 'blob' });
    const blob = res.data as Blob;
    const ext = EXT_BY_TYPE[blob.type] ?? 'jpg';
    const file = new File([blob], `${baseName}.${ext}`, { type: blob.type || 'image/jpeg' });

    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: dialogTitle });
      } catch (e: any) {
        // Feuille fermée par l'utilisateur : rien à signaler.
        if (e?.name !== 'AbortError') throw e;
      }
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = file.name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    return;
  }

  const token = await SafeStorage.getItem('auth_token');
  const tmpUri = `${FileSystem.cacheDirectory}${baseName}`;
  const res = await FileSystem.downloadAsync(uri, tmpUri, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);

  // Extension tirée du type servi : la feuille de partage s'en sert pour
  // proposer les bonnes applications.
  const type = (res.headers['Content-Type'] ?? res.headers['content-type'] ?? 'image/jpeg').split(';')[0].trim();
  const fileUri = `${tmpUri}.${EXT_BY_TYPE[type] ?? 'jpg'}`;
  await FileSystem.deleteAsync(fileUri, { idempotent: true });
  await FileSystem.moveAsync({ from: res.uri, to: fileUri });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType: type, dialogTitle });
  }
}
