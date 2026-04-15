import { create } from 'zustand';

export type AlertType = 'error' | 'success' | 'info' | 'warning';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  type: AlertType;
  buttons: AlertButton[];
  show: (title: string, message: string, buttons?: AlertButton[], type?: AlertType) => void;
  hide: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  visible: false,
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
      title,
      message,
      type: autoType,
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
    });
  },
  hide: () => set({ visible: false }),
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
