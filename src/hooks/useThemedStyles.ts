import { useMemo } from 'react';
import { type ColorPalette } from '../constants/theme';
import { useColors } from '../components/ThemeProvider';

export function useThemedStyles<T>(factory: (colors: ColorPalette) => T): T {
  const colors = useColors();
  return useMemo(() => factory(colors), [colors]);
}
