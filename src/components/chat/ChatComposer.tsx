import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Keyboard,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BorderRadius, FontSize, Fonts, Spacing, withAlpha, type ColorPalette } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useResponsive } from '../../hooks/useResponsive';
import { useColors } from '../ThemeProvider';
import { EmojiPicker } from './EmojiPicker';

/** Hauteur commune aux icônes et à la ligne de saisie — leur ligne de base. */
const ICON_SLOT = 38;

/** Même forme que l'extrait renvoyé par le serveur (ChatReplyPreview). */
export interface ComposerQuote {
  id: number;
  author: string;
  body: string;
  photo: boolean;
  mine: boolean;
}

interface ChatComposerProps {
  onSend: (body: string, imageUri: string | null) => void | Promise<void>;
  onTyping?: () => void;
  sending?: boolean;
  /** Message cité (swipe sur une bulle) ; null pour aucun. */
  quote?: ComposerQuote | null;
  onCancelQuote?: () => void;
  /** Message affiché à la place du champ quand l'échange est fermé (blocage). */
  disabledReason?: string | null;
  /** Hauteur du clavier, pour caler le panneau d'emojis dessus. */
  keyboardHeight?: number;
  /** Contrainte de largeur imposée par l'écran (colonne de lecture desktop). */
  style?: StyleProp<ViewStyle>;
  /** Ouvre le menu « joindre » (photo + objets de l'app). */
  onAttach?: () => void;
  /** Objet déjà sélectionné, à envoyer avec le message. */
  pendingItem?: { label: string; icon?: string } | null;
  onCancelItem?: () => void;
}

/**
 * Barre de saisie : texte, emojis, photo, envoi.
 *
 * La barre est posée sur une surface pleine et le champ est une pilule creusée
 * à l'intérieur : sans ce contraste, la saisie se confondait avec le fond du
 * fil et l'écran n'avait plus de bas.
 */
/** Ce que l'écran peut déclencher depuis l'extérieur (menu « joindre »). */
export interface ChatComposerHandle {
  pickImage: () => void;
}

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer({
  onSend,
  onTyping,
  sending,
  quote,
  onCancelQuote,
  disabledReason,
  keyboardHeight = 0,
  style,
  onAttach,
  pendingItem,
  onCancelItem,
}, ref) {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const { t } = useTranslation();
  const { isWide } = useResponsive();
  const inputRef = useRef<TextInput>(null);

  const [body, setBody] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const pickImage = async () => {
    // Sur mobile la permission est demandée au premier usage ; sur web le
    // sélecteur natif du navigateur s'en charge.
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setImageUri(result.assets[0].uri);
      setEmojiOpen(false);
    }
  };

  /** Emojis et clavier se disputent la même place : l'un ferme l'autre. */
  const toggleEmoji = () => {
    if (emojiOpen) {
      setEmojiOpen(false);
      inputRef.current?.focus();
    } else {
      Keyboard.dismiss();
      setEmojiOpen(true);
    }
  };

  // La photo se choisit depuis le menu « joindre », qui vit dans l'écran :
  // c'est le composer qui garde l'image, donc c'est lui qui ouvre le sélecteur.
  useImperativeHandle(ref, () => ({ pickImage }), [pickImage]);

  const submit = async () => {
    const text = body.trim();
    if ((!text && !imageUri) || sending) return;
    // On vide tout de suite : la bulle optimiste prend le relais côté store.
    setBody('');
    setImageUri(null);
    setEmojiOpen(false);
    await onSend(text, imageUri);
  };

  if (disabledReason) {
    return (
      <View style={styles.disabled}>
        <FontAwesome6 name="circle-info" size={13} color={colors.textMuted} />
        <Text style={styles.disabledText}>{disabledReason}</Text>
      </View>
    );
  }

  const canSend = (!!body.trim() || !!imageUri) && !sending;

  return (
    <View style={styles.wrap}>
      <View style={style}>
      {/* Message cité */}
      {!!quote && (
        <View style={styles.quote}>
          <View style={[styles.quoteBar, { backgroundColor: colors.secondary }]} />
          <View style={styles.quoteBody}>
            <Text style={[styles.quoteAuthor, { color: colors.secondary }]} numberOfLines={1}>
              {quote.author}
            </Text>
            <Text style={styles.quoteText} numberOfLines={1}>
              {quote.body}
            </Text>
          </View>
          <TouchableOpacity onPress={onCancelQuote} hitSlop={10}>
            <FontAwesome6 name="xmark" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Objet de l'app en attente d'envoi */}
      {!!pendingItem && (
        <View style={styles.pending}>
          <FontAwesome6 name={(pendingItem.icon ?? 'paperclip') as any} size={13} color={colors.secondary} />
          <Text style={styles.pendingText} numberOfLines={1}>{pendingItem.label}</Text>
          <TouchableOpacity onPress={onCancelItem} hitSlop={10}>
            <FontAwesome6 name="xmark" size={13} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Photo jointe */}
      {!!imageUri && (
        <View style={styles.preview}>
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
          <TouchableOpacity
            style={[styles.previewRemove, { backgroundColor: colors.error }]}
            onPress={() => setImageUri(null)}
          >
            <FontAwesome6 name="xmark" size={11} color={colors.white} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.row}>
        <View style={[styles.field, isWide && styles.fieldWide]}>
          <TouchableOpacity style={styles.fieldBtn} onPress={toggleEmoji} disabled={sending} hitSlop={8}>
            <FontAwesome6
              name={emojiOpen ? 'keyboard' : 'face-smile'}
              size={21}
              color={emojiOpen ? colors.secondary : colors.textMuted}
            />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TextInput
            ref={inputRef}
            style={styles.input}
            value={body}
            onChangeText={(v) => {
              setBody(v);
              onTyping?.();
            }}
            onFocus={() => setEmojiOpen(false)}
            placeholder={t('messages.placeholder', 'Votre message…')}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={4000}
          />

          <TouchableOpacity
            style={styles.fieldBtn}
            onPress={onAttach ?? pickImage}
            disabled={sending}
            hitSlop={8}
          >
            <FontAwesome6 name="paperclip" size={19} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={submit} disabled={!canSend} activeOpacity={0.85}>
          <LinearGradient
            colors={canSend ? [colors.primary, colors.info] : [withAlpha(colors.textMuted, 0.22), withAlpha(colors.textMuted, 0.22)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.send}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              // Flèche montante plutôt qu'un avion en papier : celui de
              // FontAwesome est le logo de Telegram, à ne pas emprunter.
              <FontAwesome6 name="arrow-up" size={18} color={colors.white} />
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      </View>

      {emojiOpen && (
        <EmojiPicker
          height={keyboardHeight > 180 ? keyboardHeight : 260}
          onPick={(emoji) => {
            setBody((v) => v + emoji);
            onTyping?.();
          }}
        />
      )}
    </View>
  );
});

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    wrap: {
      borderTopWidth: 1,
      borderTopColor: Colors.border,
      // Fond sobre : c'est la pilule posée dessus qui porte le regard.
      backgroundColor: Colors.background,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    field: {
      flex: 1,
      flexDirection: 'row',
      // Tout se cale sur la même ligne de base : icônes et champ partagent la
      // même hauteur utile (ICON_SLOT), et le champ grandit vers le haut quand
      // le texte passe à la ligne. C'est ce qui manquait — des boutons de 44
      // contre un champ plus court donnaient des icônes flottantes.
      alignItems: 'flex-end',
      minHeight: ICON_SLOT + 10,
      borderRadius: (ICON_SLOT + 10) / 2,
      borderWidth: 1,
      borderColor: Colors.border,
      // Creux dans la barre — plus sombre en thème sombre, plus clair en clair.
      backgroundColor: Colors.cardSolid,
      paddingHorizontal: 5,
      paddingVertical: 5,
      // La pilule se détache de la barre : c'est elle l'objet actif, pas le fond.
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
    pending: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
    },
    pendingText: {
      flex: 1,
      fontFamily: Fonts.medium,
      fontSize: FontSize.sm,
      color: Colors.text,
    },
    divider: {
      width: 1,
      alignSelf: 'center',
      height: 22,
      backgroundColor: Colors.border,
      marginRight: 2,
    },
    fieldWide: {
      minHeight: ICON_SLOT + 20,
      borderRadius: (ICON_SLOT + 20) / 2,
      paddingHorizontal: Spacing.sm,
    },
    fieldBtn: {
      width: ICON_SLOT,
      height: ICON_SLOT,
      borderRadius: ICON_SLOT / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    input: {
      flex: 1,
      minHeight: ICON_SLOT,
      maxHeight: 120,
      color: Colors.text,
      fontFamily: Fonts.regular,
      fontSize: FontSize.md,
      // Padding symétrique calé sur la hauteur des icônes : le texte tombe
      // exactement au centre de la même bande qu'elles.
      paddingTop: Platform.OS === 'ios' ? 9 : 7,
      paddingBottom: Platform.OS === 'ios' ? 9 : 7,
      paddingHorizontal: Spacing.xs,
      textAlignVertical: 'center',
    },
    send: {
      width: ICON_SLOT + 10,
      height: ICON_SLOT + 10,
      borderRadius: (ICON_SLOT + 10) / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
    },
    quoteBar: {
      width: 3,
      alignSelf: 'stretch',
      borderRadius: 2,
      minHeight: 32,
    },
    quoteBody: {
      flex: 1,
      minWidth: 0,
    },
    quoteAuthor: {
      fontFamily: Fonts.bold,
      fontSize: FontSize.xs,
    },
    quoteText: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.sm,
      color: Colors.textMuted,
      marginTop: 1,
    },
    preview: {
      alignSelf: 'flex-start',
      marginTop: Spacing.sm,
      marginLeft: Spacing.md,
    },
    previewImage: {
      width: 76,
      height: 76,
      borderRadius: BorderRadius.md,
    },
    previewRemove: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    disabled: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: Colors.border,
      backgroundColor: Colors.cardSolid,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    disabledText: {
      fontFamily: Fonts.medium,
      fontSize: FontSize.sm,
      color: Colors.textMuted,
      textAlign: 'center',
      flexShrink: 1,
    },
  });
