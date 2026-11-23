import React from 'react';
import { create } from 'zustand';
import type { FlowDirection } from '../../addons/types';
import { CryptoModal } from './CryptoModal';
import { useCryptoAccess } from '../access';
import { useCryptoSetting } from '../config';

type Tab = 'buy' | 'sell';

interface FlowState {
  visible: boolean;
  tab: Tab;
  currency?: string;
}

const useFlow = create<FlowState>(() => ({ visible: false, tab: 'sell' }));

/**
 * Opens the buy/sell modal. Topping up the wallet with crypto is a sale,
 * sending crypto out of it is a purchase.
 */
export function startFlow(direction: FlowDirection, item?: string) {
  useFlow.setState({ visible: true, tab: direction === 'in' ? 'sell' : 'buy', currency: item });
}

/** Mounted once on the home screen. */
export function Host() {
  const { visible, tab, currency } = useFlow();
  const active = useCryptoAccess((s) => s.active);
  const buyEnabled = useCryptoSetting('crypto_buy_enabled');
  const sellEnabled = useCryptoSetting('crypto_sell_enabled');
  if (!active) return null;
  return (
    <CryptoModal
      visible={visible}
      onClose={() => useFlow.setState({ visible: false })}
      buyEnabled={buyEnabled}
      sellEnabled={sellEnabled}
      initialTab={tab}
      initialCurrency={currency}
      forceTab
    />
  );
}
