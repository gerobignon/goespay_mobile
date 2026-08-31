import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Réduction systématique des images choisies dans l'app avant envoi au backend.
 *
 * POURQUOI : les photos des téléphones récents font plusieurs milliers de pixels
 * de côté et pèsent bien au-delà des 4 Mo acceptés par l'API. Toute image qui
 * dépasse la dimension attendue est donc ramenée à cette dimension (plus grand
 * côté borné, ratio conservé, aucun recadrage : les images très allongées
 * passent aussi), puis recompressée tant que le poids reste au-dessus de la
 * limite. Un seul point de passage pour tous les sélecteurs de l'app.
 */

/** Plus grand côté par défaut : 720p. */
export const MAX_EDGE_DEFAULT = 1280;
/** Documents d'identité : plus de pixels, sinon les mentions deviennent illisibles. */
export const MAX_EDGE_DOCUMENT = 1600;
/** Photo de profil : toujours affichée petite. */
export const MAX_EDGE_AVATAR = 720;

/** Limite backend (4096 Ko), avec une marge pour l'enrobage multipart. */
const MAX_BYTES = 3.8 * 1024 * 1024;
/** Qualités JPEG essayées, de la meilleure à la plus économe. */
const QUALITIES = [0.7, 0.5, 0.35];

export type CompressOptions = {
  /** Dimensions de l'image d'origine, telles que fournies par le sélecteur. */
  width?: number;
  height?: number;
  /** Plus grand côté visé. */
  maxEdge?: number;
};

/** Poids du fichier en octets, ou `null` si la plateforme ne sait pas le dire. */
async function fileSize(uri: string): Promise<number | null> {
  try {
    if (Platform.OS === 'web') {
      const blob = await (await fetch(uri)).blob();
      return blob.size;
    }
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists ? (info.size ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * Ramène l'image sous la dimension visée, en JPEG, sous la limite de poids.
 * En cas d'échec du redimensionnement, l'URI d'origine est renvoyée telle
 * quelle : c'est alors le backend qui tranche.
 */
export async function compressImage(uri: string, options: CompressOptions = {}): Promise<string> {
  const { maxEdge = MAX_EDGE_DEFAULT } = options;
  let { width, height } = options;

  // Le sélecteur ne donne pas toujours les dimensions : une passe à vide les
  // renvoie, ce qui évite d'agrandir par erreur une image déjà petite.
  if (!width || !height) {
    try {
      const probe = await ImageManipulator.manipulateAsync(uri, []);
      width = probe.width;
      height = probe.height;
    } catch {
      return uri;
    }
  }

  // Plus grand côté borné, ratio conservé. Image déjà plus petite : simple
  // recompression.
  const resize =
    Math.max(width, height) > maxEdge
      ? width >= height
        ? { width: maxEdge }
        : { height: maxEdge }
      : null;

  let last = uri;
  for (const compress of QUALITIES) {
    try {
      const out = await ImageManipulator.manipulateAsync(
        uri,
        resize ? [{ resize }] : [],
        { compress, format: ImageManipulator.SaveFormat.JPEG }
      );
      last = out.uri;
    } catch {
      return last;
    }
    const size = await fileSize(last);
    if (size === null || size <= MAX_BYTES) return last;
  }
  return last;
}
