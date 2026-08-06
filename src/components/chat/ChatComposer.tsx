import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BorderRadius, FontSize, Fonts, Spacing, withAlpha, type ColorPalette } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useColors } from '../ThemeProvider';

interface ChatComposerProps {
  onSend: (body: string, imageUri: string | null) => void | Promise<void>;
  onTyping?: () => void;
  sending?: boolean;
  /** Message affiché à la place du champ quand l'échange est fermé (blocage). */
  disabledReason?: string | null;
}

/** Barre de saisie : texte, photo optionnelle, envoi. */
export function ChatComposer({ onSend, onTyping, sending, disabledReason }: ChatComposerProps) {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const { t } = useTranslation();

  const [body, setBody] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

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
    }
  };

  const submit = async () => {
    const text = body.trim();
    if ((!text && !imageUri) || sending) return;
    // On vide tout de suite : la bulle optimiste prend le relais côté store.
    setBody('');
    setImageUri(null);
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
        <TouchableOpacity style={styles.clip} onPress={pickImage} disabled={sending}>
          <FontAwesome6 name="paperclip" size={17} color={colors.textMuted} />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          value={body}
          onChangeText={(v) => {
            setBody(v);
            onTyping?.();
          }}
          placeholder={t('messages.placeholder', 'Votre message…')}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={4000}
        />

        <TouchableOpacity
          style={[
            styles.send,
            { backgroundColor: canSend ? colors.primary : withAlpha(colors.textMuted, 0.25) },
          ]}
          onPress={submit}
          disabled={!canSend}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <FontAwesome6 name="paper-plane" size={15} color={colors.white} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    wrap: {
      borderTopWidth: 1,
      borderTopColor: Colors.border,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
      backgroundColor: Colors.background,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Spacing.sm,
    },
    input: {
      flex: 1,
      minHeight: 42,
      maxHeight: 120,
      borderRadius: BorderRadius.xl,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.inputBg,
      color: Colors.text,
      fontFamily: Fonts.regular,
      fontSize: FontSize.md,
      paddingHorizontal: Spacing.md,
      paddingTop: Platform.OS === 'ios' ? 11 : 8,
      paddingBottom: Platform.OS === 'ios' ? 11 : 8,
    },
    clip: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    send: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
    },
    preview: {
      alignSelf: 'flex-start',
      marginBottom: Spacing.sm,
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
