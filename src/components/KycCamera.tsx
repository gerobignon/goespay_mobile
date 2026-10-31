import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { Colors, Fonts, FontSize, Spacing } from '../constants/theme';
import { hasLiveCamera } from '../utils/kycDevice';

/**
 * Caméra du KYC sur le web (PWA et navigateur de téléphone ou de tablette).
 *
 * Règle de Géraud (31/10/2026) : jamais de KYC sans caméra en direct. Sur le
 * web, `ImagePicker.launchCameraAsync` n'ouvre qu'un `<input type="file"
 * capture>` : un ordinateur, et certains navigateurs de téléphone, en font un
 * sélecteur de fichiers. Ici l'image ne peut venir que du flux de la caméra
 * (getUserMedia), dessiné dans un canvas au déclenchement. Aucun chemin vers un
 * fichier. Caméra absente ou refusée : message court, pas de photo.
 *
 * Variante native : `KycCamera.native.tsx`, jamais montée (l'appareil photo du
 * système est ouvert par `launchCameraAsync`).
 */

/** Arrière (`environment`) pour les pièces, avant (`user`) pour le selfie. */
export type KycCameraFacing = 'environment' | 'user';

export interface KycCameraProps {
  visible: boolean;
  facing: KycCameraFacing;
  /** Libellé de la prise de vue (recto, verso, selfie). */
  title?: string;
  /** URL locale (blob:) de la photo prise, en JPEG. */
  onCapture: (uri: string) => void;
  onClose: () => void;
}

type Phase = 'starting' | 'live' | 'shot' | 'denied' | 'unavailable';

/**
 * Résolution demandée : la plus haute courante (4K). Le navigateur retient le
 * mode le plus proche que la caméra sait fournir ; l'image est ensuite ramenée
 * à la taille des documents par `compressImage`.
 */
const IDEAL_RESOLUTION = { width: { ideal: 3840 }, height: { ideal: 2160 } };

const DENIED_ERRORS = ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'];

export function KycCamera({ visible, facing, title, onCapture, onClose }: KycCameraProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>('starting');
  // Caméra choisie par le bouton de bascule ; null = celle de la prise de vue.
  const [flipped, setFlipped] = useState<KycCameraFacing | null>(null);
  const [canFlip, setCanFlip] = useState(false);
  const [mirrored, setMirrored] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const activeFacing = flipped ?? facing;

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  /** Branche le flux sur la vidéo dès que les deux existent. */
  const attachStream = useCallback(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream || video.srcObject === stream) return;
    video.muted = true;
    video.setAttribute('playsinline', '');
    video.srcObject = stream;
    video.play().catch(() => {});
  }, []);

  const setVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    attachStream();
  }, [attachStream]);

  // Fermeture : on repart de la caméra demandée, sans photo en attente.
  useEffect(() => {
    if (visible) return;
    setFlipped(null);
    setShot((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [visible]);

  // Ouverture, bascule ou nouvel essai : (re)demande la caméra.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setPhase('starting');
    if (!hasLiveCamera()) {
      setPhase('unavailable');
      return;
    }
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: activeFacing }, ...IDEAL_RESOLUTION },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        track?.addEventListener('ended', () => {
          if (!cancelled) setPhase('unavailable');
        });
        const actual = track?.getSettings?.().facingMode;
        setMirrored((actual || activeFacing) === 'user');
        attachStream();
        setPhase('live');
        // Bascule proposée seulement s'il existe une autre caméra (libellés et
        // nombre ne sont connus qu'une fois l'autorisation donnée).
        navigator.mediaDevices
          .enumerateDevices()
          .then((list) => {
            if (!cancelled) setCanFlip(list.filter((d) => d.kind === 'videoinput').length > 1);
          })
          .catch(() => {});
      } catch (e) {
        if (cancelled) return;
        const name = (e as { name?: string } | null)?.name ?? '';
        setPhase(DENIED_ERRORS.includes(name) ? 'denied' : 'unavailable');
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [visible, activeFacing, attempt, attachStream, stopStream]);

  /** Déclenchement : l'image affichée par la caméra, à sa pleine résolution. */
  const capture = () => {
    const video = videoRef.current;
    if (phase !== 'live' || !video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setShot((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setPhase('shot');
      },
      'image/jpeg',
      0.92
    );
  };

  const retake = () => {
    setShot((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPhase(streamRef.current ? 'live' : 'starting');
    if (!streamRef.current) setAttempt((n) => n + 1);
  };

  const confirm = () => {
    if (!shot) return;
    const uri = shot;
    // L'URL passe à l'écran KYC, qui la libère après compression.
    setShot(null);
    stopStream();
    onCapture(uri);
  };

  const close = () => {
    stopStream();
    onClose();
  };

  const flip = () => setFlipped(activeFacing === 'user' ? 'environment' : 'user');

  const failed = phase === 'denied' || phase === 'unavailable';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.root}>
        {React.createElement('video', {
          ref: setVideo,
          autoPlay: true,
          playsInline: true,
          muted: true,
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            backgroundColor: '#000',
            // Selfie : aperçu en miroir, comme un miroir. La photo, elle, reste à
            // l'endroit (la pièce tenue en main doit rester lisible).
            transform: mirrored ? 'scaleX(-1)' : 'none',
          },
        })}

        {phase === 'shot' && !!shot && (
          <View style={styles.shotLayer}>
            <Image source={{ uri: shot }} style={styles.shotImage} resizeMode="contain" />
          </View>
        )}

        {phase === 'starting' && (
          <View style={styles.center} pointerEvents="none">
            <ActivityIndicator size="large" color={Colors.white} />
          </View>
        )}

        {failed && (
          <View style={styles.center}>
            <View style={styles.errorIcon}>
              <FontAwesome6 name="video-slash" size={26} color={Colors.white} />
            </View>
            <Text style={styles.errorText}>
              {phase === 'denied' ? t('kyc.cameraPermission') : t('kyc.cameraUnavailable')}
            </Text>
            <View style={styles.errorActions}>
              <Button title={t('common.retry')} icon="rotate-right" onPress={() => setAttempt((n) => n + 1)} />
              <Button title={t('common.close')} variant="outline" onPress={close} />
            </View>
          </View>
        )}

        <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
          <Pressable
            style={styles.roundBtn}
            onPress={close}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <FontAwesome6 name="xmark" size={18} color={Colors.white} />
          </Pressable>
          <Text style={styles.title} numberOfLines={2}>{title ?? ''}</Text>
          <View style={styles.roundGhost} />
        </View>

        {!failed && (
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.lg }]}>
            {phase === 'shot' ? (
              <View style={styles.shotActions}>
                <Button title={t('kyc.retake')} icon="rotate-right" variant="outline" onPress={retake} style={styles.shotBtn} />
                <Button title={t('common.validate')} icon="check" onPress={confirm} style={styles.shotBtn} />
              </View>
            ) : (
              <View style={styles.liveActions}>
                <View style={styles.roundGhost} />
                <Pressable
                  style={[styles.shutter, phase !== 'live' && styles.shutterIdle]}
                  onPress={capture}
                  disabled={phase !== 'live'}
                  accessibilityRole="button"
                  accessibilityLabel={title}
                >
                  <View style={styles.shutterInner} />
                </Pressable>
                {canFlip ? (
                  <Pressable
                    style={styles.roundBtn}
                    onPress={flip}
                    hitSlop={8}
                    disabled={phase !== 'live'}
                    accessibilityRole="button"
                  >
                    <FontAwesome6 name="camera-rotate" size={18} color={Colors.white} />
                  </Pressable>
                ) : (
                  <View style={styles.roundGhost} />
                )}
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const ROUND = 44;
const SHUTTER = 76;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  shotLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  shotImage: {
    width: '100%',
    height: '100%',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: Spacing.md,
  },
  errorText: {
    color: Colors.white,
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.md,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  errorActions: {
    width: '100%',
    maxWidth: 320,
    gap: Spacing.sm,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  title: {
    flex: 1,
    color: Colors.white,
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.md,
    textAlign: 'center',
    marginHorizontal: Spacing.sm,
  },
  roundBtn: {
    width: ROUND,
    height: ROUND,
    borderRadius: ROUND / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  roundGhost: {
    width: ROUND,
    height: ROUND,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  liveActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 360,
    width: '100%',
    alignSelf: 'center',
  },
  shutter: {
    width: SHUTTER,
    height: SHUTTER,
    borderRadius: SHUTTER / 2,
    borderWidth: 4,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterIdle: {
    opacity: 0.4,
  },
  shutterInner: {
    width: SHUTTER - 16,
    height: SHUTTER - 16,
    borderRadius: (SHUTTER - 16) / 2,
    backgroundColor: Colors.white,
  },
  shotActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  shotBtn: {
    flex: 1,
  },
});
