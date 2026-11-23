import { AddonScreen } from '../../src/addons/AddonRoute';

/** Saved addresses: screen provided by the add-on loaded after login (src/addons). */
export default function WalletsRoute() {
  return <AddonScreen name="wallets" />;
}
