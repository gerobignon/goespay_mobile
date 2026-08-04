import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';

const MIN = 1;
const MAX = 4;
const STEP = 0.75;

/** Visionneuse plein écran : zoom (+/−, double tap) et déplacement au doigt. */
export function DevImageViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const [scale, setScale] = useState(1);
  const lastTap = useRef(0);

  useEffect(() => {
    if (uri) setScale(1);
  }, [uri]);

  const zoom = (delta: number) => setScale((s) => Math.min(MAX, Math.max(MIN, +(s + delta).toFixed(2))));

  const onImagePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setScale((s) => (s > 1 ? 1 : 2.5));
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <ScrollView
          style={StyleSheet.absoluteFill}
          contentContainerStyle={{ minWidth: '100%', minHeight: '100%', alignItems: 'center', justifyContent: 'center' }}
          maximumZoomScale={MAX}
          minimumZoomScale={MIN}
          bouncesZoom
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          <ScrollView
            horizontal
            contentContainerStyle={{ alignItems: 'center', justifyContent: 'center' }}
            showsHorizontalScrollIndicator={false}
          >
            <TouchableWithoutFeedback onPress={onImagePress}>
              <Image
                source={{ uri: uri || '' }}
                style={{ width: width * scale, height: height * scale }}
                resizeMode="contain"
              />
            </TouchableWithoutFeedback>
          </ScrollView>
        </ScrollView>

        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolBtn} onPress={() => zoom(-STEP)} disabled={scale <= MIN}>
            <FontAwesome6 name="magnifying-glass-minus" size={16} color="#fff" style={{ opacity: scale <= MIN ? 0.4 : 1 }} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={() => setScale(1)}>
            <FontAwesome6 name="arrows-to-dot" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={() => zoom(STEP)} disabled={scale >= MAX}>
            <FontAwesome6 name="magnifying-glass-plus" size={16} color="#fff" style={{ opacity: scale >= MAX ? 0.4 : 1 }} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.close} onPress={onClose} hitSlop={10}>
          <FontAwesome6 name="xmark" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  close: {
    position: 'absolute',
    top: 44,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    padding: 6,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  toolBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
