import { useAddons } from './registry';
import { CRYPTO_TYPE, cryptoKind } from '../crypto/kind';

/**
 * Native variant (iOS, Android): no add-on is ever loaded.
 *
 * The apps offer no crypto service (an exchange licence is required by the
 * stores in every country of distribution), so the crypto add-on is not even
 * part of the binaries: Metro picks this file instead of `boot.ts`, which is
 * the only place that references it. Customers still read the crypto
 * operations they made in the past, hence the history presentation below.
 */
useAddons.setState({
  status: 'none',
  kinds: { [CRYPTO_TYPE]: cryptoKind() },
});

export function bootAddons(): Promise<void> {
  return Promise.resolve();
}
