import { useLocalSearchParams } from 'expo-router';
import { AddonTransaction } from '../../../src/addons/AddonRoute';

/**
 * Detail of a transaction whose type comes from an add-on (src/addons). The
 * deposit, transfer and withdraw folders are static routes and win over this
 * one; any other type lands here and is served by the add-on that owns it.
 */
export default function AddonTransactionRoute() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  return <AddonTransaction type={String(kind)} id={parseInt(String(id), 10)} />;
}
