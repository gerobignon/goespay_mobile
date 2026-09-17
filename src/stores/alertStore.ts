import { create } from 'zustand';

export type AlertType = 'error' | 'success' | 'info' | 'warning';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertState {
  visible: boolean;
  /** Numéro de l'alerte affichée : il change à chaque ouverture. */
  seq: number;
  title: string;
  message: string;
  type: AlertType;
  buttons: AlertButton[];
  show: (title: string, message: string, buttons?: AlertButton[], type?: AlertType) => void;
  /**
   * Ferme l'alerte. Avec un numéro, ne ferme que si c'est toujours celle-là :
   * un bouton qui ouvre une seconde alerte ne voit plus la sienne effacée
   * dans la foulée, l'écran ne reste donc jamais muet après un appui.
   */
  hide: (seq?: number) => void;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  visible: false,
  seq: 0,
  title: '',
  message: '',
  type: 'info',
  buttons: [],
  show: (title, message, buttons, type) => {
    // Auto-detect type from title
    const autoType =
      type ??
      (title.toLowerCase().includes('erreur') || title.toLowerCase().includes('impossible')
        ? 'error'
        : title.toLowerCase().includes('succès') || title.toLowerCase().includes('envoyé')
          ? 'success'
          : title.toLowerCase().includes('requis') || title.toLowerCase().includes('attention')
            ? 'warning'
            : 'info');
    set({
      visible: true,
      seq: get().seq + 1,
      title,
      message,
      type: autoType,
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
    });
  },
  hide: (seq) => {
    if (seq != null && seq !== get().seq) return;
    set({ visible: false });
  },
}));

/** Drop-in replacement for Alert.alert */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  type?: AlertType,
) {
  useAlertStore.getState().show(title, message ?? '', buttons, type);
}
