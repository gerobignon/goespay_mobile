import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Platform, TouchableWithoutFeedback } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { AlertOverlay } from './AlertOverlay';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useTheme } from './ThemeProvider';
import { useStoreReviewStore } from '../stores/storeReviewStore';
import { type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { ANDROID_PACKAGE, IOS_APP_ID, mobileStore } from '../utils/nativeAppPromo';

const IOS_REVIEW_URL = `https://apps.apple.com/app/id${IOS_APP_ID}?action=write-review`;
const PLAY_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

/** Fiche du store où écrire l'avis, null sur ordinateur : le client choisit son store. */
function reviewTargets(): string[] | null {
  if (Platform.OS === 'ios') return [`itms-apps://apps.apple.com/app/id${IOS_APP_ID}?action=write-review`, IOS_REVIEW_URL];
  if (Platform.OS === 'android') return [`market://details?id=${ANDROID_PACKAGE}`, PLAY_URL];
  const store = mobileStore();
  if (store === 'appstore') return [IOS_REVIEW_URL];
  if (store === 'play') return [PLAY_URL];
  return null;
}

// Sur le web, window.open doit partir dans le geste du clic, sinon le navigateur le bloque.
function openReview(urls: string[]): void {
  if (Platform.OS === 'web') {
    try {
      const win = window.open(urls[0], '_blank', 'noopener');
      if (!win) window.location.href = urls[0];
    } catch {
      window.location.href = urls[0];
    }
    return;
  }
  (async () => {
    for (const url of urls) {
      try {
        await Linking.openURL(url);
        return;
      } catch {}
    }
  })();
}

/**
 * Fenêtre d'invitation à noter l'app, montée une seule fois à la racine.
 * Ouverte par storeReviewStore après une opération réussie.
 *
 * Chaque étoile mène à la fiche du store, quelle que soit la note : pas de tri
 * des clients mécontents, interdit par Google Play et l'App Store.
 */
export function StoreReviewPrompt() {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const visible = useStoreReviewStore((s) => s.visible);
  const markRated = useStoreReviewStore((s) => s.markRated);
  const snooze = useStoreReviewStore((s) => s.snooze);
  const hide = useStoreReviewStore((s) => s.hide);
  const [picked, setPicked] = useState(0);
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    if (visible) { setPicked(0); setChoosing(false); }
  }, [visible]);

  const open = (urls: string[]) => {
    openReview(urls);
    markRated();
  };

  const rate = (stars: number) => {
    setPicked(stars);
    const targets = reviewTargets();
    if (targets) open(targets);
    else setChoosing(true);
  };

  return (
    <AlertOverlay visible={visible} onRequestClose={hide}>
      <TouchableWithoutFeedback onPress={hide}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.container}>
              <Text style={styles.title}>{t('storeReview.title')}</Text>
              <Text style={styles.text}>{t('storeReview.text')}</Text>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => rate(n)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`${n}/5`}
                    style={({ pressed }) => pressed && { opacity: 0.6 }}
                  >
                    <FontAwesome6
                      name="star"
                      solid={!picked || n <= picked}
                      size={36}
                      color={colors.secondary}
                    />
                  </Pressable>
                ))}
              </View>
              {choosing && (
                <View style={styles.storeRow}>
                  <Button
                    title="Google Play"
                    icon="google-play"
                    iconBrand
                    onPress={() => open([PLAY_URL])}
                    style={styles.store}
                  />
                  <Button
                    title="App Store"
                    icon="apple"
                    iconBrand
                    onPress={() => open([IOS_REVIEW_URL])}
                    style={styles.store}
                  />
                </View>
              )}
              <Pressable onPress={snooze} hitSlop={8} accessibilityRole="button">
                <Text style={styles.later}>{t('storeReview.later')}</Text>
              </Pressable>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </AlertOverlay>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    padding: Spacing.lg,
    gap: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    textAlign: 'center',
  },
  text: {
    fontSize: FontSize.md,
    lineHeight: 22,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  stars: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginVertical: Spacing.sm,
  },
  storeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    width: '100%',
  },
  store: {
    flexGrow: 1,
    flexBasis: 140,
  },
  later: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
    marginTop: Spacing.xs,
  },
});
