import { useAddons } from './registry';

// ─────────────────────────────────────────────────────────────────────────
// Loads the add-ons once the user is signed in (web).
//
// `import()` makes the bundler emit the add-on as a separate file, fetched
// only when this function runs: the page a visitor (or a crawler) opens
// without an account never references its code nor its wording. Keep it
// that way: shared code must never import from an add-on folder, only from
// `src/addons/`, and add-ons are listed in `installed.ts`, never here.
// ─────────────────────────────────────────────────────────────────────────

/** Delays before each attempt: a deploy can briefly serve a stale entry. */
const ATTEMPTS_MS = [0, 2_000, 8_000];

let inflight: Promise<void> | null = null;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function bootAddons(): Promise<void> {
  const { status } = useAddons.getState();
  if (status === 'ready' || status === 'none') return Promise.resolve();
  if (inflight) return inflight;

  useAddons.setState({ status: 'loading' });
  inflight = (async () => {
    let lastError: unknown = null;
    for (const delay of ATTEMPTS_MS) {
      if (delay) await wait(delay);
      try {
        const { install } = await import('./installed');
        install();
        return;
      } catch (error) {
        lastError = error;
      }
    }
    console.warn('[addons] load failed', lastError);
    useAddons.setState({ status: 'failed' });
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
