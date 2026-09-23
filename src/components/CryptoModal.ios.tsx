/**
 * Variante iOS : l'achat et la vente de crypto-monnaies sont absents du binaire
 * iOS (règle App Store 3.1.5(iii)). Metro résout ce fichier à la place de
 * `CryptoModal.tsx`, ce qui retire du bundle le parcours complet, les appels à
 * l'API, la validation des adresses et le nom du prestataire.
 *
 * Le modal n'est de toute façon jamais monté sur iOS : `CRYPTO_AVAILABLE`
 * (`constants/features`) coupe l'entrée dans tous les écrans.
 */
type Tab = 'buy' | 'sell';

interface CryptoModalProps {
  visible: boolean;
  onClose: () => void;
  buyEnabled?: boolean;
  sellEnabled?: boolean;
  initialTab?: Tab;
  initialCurrency?: string;
  forceTab?: boolean;
}

export function CryptoModal(_props: CryptoModalProps) {
  return null;
}
