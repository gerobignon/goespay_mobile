import { useWindowDimensions } from 'react-native';

export type DeviceSize = 'mobile' | 'tablet' | 'desktop';

const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
};

export function useResponsive() {
  const { width, height } = useWindowDimensions();

  const deviceSize: DeviceSize =
    width >= BREAKPOINTS.desktop
      ? 'desktop'
      : width >= BREAKPOINTS.tablet
        ? 'tablet'
        : 'mobile';

  const isMobile = deviceSize === 'mobile';
  const isTablet = deviceSize === 'tablet';
  const isDesktop = deviceSize === 'desktop';
  const isWide = isTablet || isDesktop;

  // Content max width for centered layouts
  const contentMaxWidth = isDesktop ? 1200 : isTablet ? 900 : width;

  // Grid columns for service cards etc
  const gridColumns = isDesktop ? 4 : isTablet ? 4 : 4;

  // Modal width: centered panel on wide screens
  const modalWidth = isDesktop ? 780 : isTablet ? 640 : width;

  // Sidebar width for desktop navigation
  const sidebarWidth = 240;

  return {
    width,
    height,
    deviceSize,
    isMobile,
    isTablet,
    isDesktop,
    isWide,
    contentMaxWidth,
    gridColumns,
    modalWidth,
    sidebarWidth,
  };
}
