import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { ScreenBackground } from '../components/ScreenBackground';
import { Colors } from '../constants/theme';
import { addonPending, useAddons } from './registry';

/** Waits for the add-ons, then shows `children`, or goes home when nothing serves the route. */
function Resolve({ ready, children }: { ready: boolean; children: () => React.ReactNode }) {
  const status = useAddons((s) => s.status);
  if (ready) return <>{children()}</>;
  if (addonPending(status)) {
    return (
      <ScreenBackground>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.secondary} />
        </View>
      </ScreenBackground>
    );
  }
  return <Redirect href="/(tabs)" />;
}

/** Screen `name` of the loaded add-on (route `/account/<name>`). */
export function AddonScreen({ name }: { name: string }) {
  const Screen = useAddons((s) => s.addon?.screens[name]);
  return <Resolve ready={!!Screen}>{() => (Screen ? <Screen /> : null)}</Resolve>;
}

/** Detail of a transaction whose type an add-on brings (route `/transaction/<type>/<id>`). */
export function AddonTransaction({ type, id }: { type: string; id: number }) {
  const Detail = useAddons((s) => s.kinds[type]?.Detail);
  return <Resolve ready={!!Detail && Number.isFinite(id)}>{() => (Detail ? <Detail id={id} /> : null)}</Resolve>;
}
