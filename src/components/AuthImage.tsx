import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageResizeMode,
  ImageStyle,
  Platform,
  StyleProp,
  View,
} from 'react-native';
import api from '../services/api';
import { SafeStorage } from '../services/storage';
import { useColors } from './ThemeProvider';

/**
 * Affichage d'une image servie derrière l'authentification.
 *
 * Les pièces KYC et les pièces jointes de messagerie ne sont plus des fichiers
 * publics devinables : le serveur les rend sur des routes API qui exigent le
 * jeton. Une balise `<Image src>` ordinaire n'envoie aucun en-tête, elle ne
 * peut donc plus les charger. Deux voies :
 *
 *  · natif, `source.headers` : React Native joint l'en-tête à sa requête.
 *  · web : le navigateur ignore `source.headers`. On télécharge le binaire par
 *    axios (qui porte déjà le Bearer), et on affiche l'object URL du blob.
 *
 * Un cache mémoire par URL évite de retélécharger la même pièce à chaque
 * rendu, et les téléchargements simultanés de la même URL sont mutualisés.
 */

/** URL servie par l'API mobile, donc protégée par le jeton. */
export function isProtectedUrl(uri: string | null | undefined): boolean {
  if (!uri) return false;
  if (/^(data|blob|file|content|ph|assets-library):/i.test(uri)) return false;
  return uri.includes('/api/mobile/v1/');
}

/** Object URL déjà obtenu, par URL source (web seulement). */
const blobCache = new Map<string, string>();
/** Téléchargements en cours, pour ne pas lancer deux fois la même requête. */
const inflight = new Map<string, Promise<string>>();

async function fetchAsObjectUrl(uri: string): Promise<string> {
  const cached = blobCache.get(uri);
  if (cached) return cached;

  const pending = inflight.get(uri);
  if (pending) return pending;

  const task = (async () => {
    const res = await api.get(uri, { responseType: 'blob'});
    const objectUrl = URL.createObjectURL(res.data as Blob);
    blobCache.set(uri, objectUrl);
    return objectUrl;
  })().finally(() => {
    inflight.delete(uri);
  });

  inflight.set(uri, task);
  return task;
}

export interface AuthImageSource {
  uri: string;
  headers?: Record<string, string>;
}

/**
 * Source affichable pour `uri`, ou null tant qu'elle n'est pas prête.
 *
 * Une URL locale (photo qu'on vient de prendre) ou publique passe telle quelle,
 * sans requête supplémentaire.
 */
export function useAuthImage(uri: string | null | undefined) {
  const [source, setSource] = useState<AuthImageSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);

    if (!uri) {
      setSource(null);
      setLoading(false);
      return;
    }

    if (!isProtectedUrl(uri)) {
      setSource({ uri });
      setLoading(false);
      return;
    }

    setLoading(true);

    if (Platform.OS === 'web') {
      fetchAsObjectUrl(uri)
        .then((objectUrl) => {
          if (!alive) return;
          setSource({ uri: objectUrl });
        })
        .catch(() => {
          if (alive) setFailed(true);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    } else {
      SafeStorage.getItem('auth_token')
        .then((token) => {
          if (!alive) return;
          setSource({ uri, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
        })
        .catch(() => {
          if (alive) setFailed(true);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }

    return () => {
      alive = false;
    };
  }, [uri]);

  return { source, loading, failed };
}

interface Props {
  uri: string | null | undefined;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  /** Rendu quand l'image ne peut pas être chargée (jeton refusé, réseau). */
  fallback?: React.ReactNode;
  onLoadSize?: (size: { width: number; height: number }) => void;
}

/** Image protégée, avec son état de chargement. */
export function AuthImage({ uri, style, resizeMode = 'cover', fallback = null, onLoadSize }: Props) {
  const colors = useColors();
  const { source, loading, failed } = useAuthImage(uri);

  if (loading || (!source && !failed)) {
    return (
      <View style={[style as any, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (failed || !source) {
    return <>{fallback}</>;
  }

  return (
    <Image
      source={source}
      style={style}
      resizeMode={resizeMode}
      onLoad={
        onLoadSize
          ? (e) => onLoadSize({ width: e.nativeEvent.source.width, height: e.nativeEvent.source.height })
          : undefined
      }
    />
  );
}
