/**
 * Variante native (iOS et Android) : jamais montée. Sur téléphone, le KYC ouvre
 * l'appareil photo du système par `ImagePicker.launchCameraAsync` (cf.
 * `app/kyc.tsx`), sans accès à la galerie. Metro résout ce fichier à la place
 * de `KycCamera.tsx`, qui ne sert qu'au web.
 */
export type KycCameraFacing = 'environment' | 'user';

export interface KycCameraProps {
  visible: boolean;
  facing: KycCameraFacing;
  title?: string;
  onCapture: (uri: string) => void;
  onClose: () => void;
}

export function KycCamera(_props: KycCameraProps) {
  return null;
}
