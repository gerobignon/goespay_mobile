/**
 * Add-ons shipped with this build, installed once the user is signed in.
 *
 * This file is the boundary of the separate bundle: `boot.ts` reaches it
 * through `import()` only, so it and everything it imports stay out of the
 * main bundle (the module path of a dynamic import is kept in clear in the
 * entry file, hence this neutral name). Add a line per add-on.
 */
import { install as installCrypto } from '../crypto/addon';

export function install(): void {
  installCrypto();
}
