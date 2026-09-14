const query = typeof matchMedia === 'function' ? matchMedia('(orientation: portrait)') : null;

export const orientation = $state<{ isPortrait: boolean }>({
  isPortrait: query?.matches ?? false,
});

query?.addEventListener('change', (event) => {
  orientation.isPortrait = event.matches;
});

let lockAttempted = false;

/** Best-effort landscape lock; only works inside an installed PWA. Safe to call from any gesture. */
export function requestLandscapeLockOnce(): void {
  if (lockAttempted) return;
  lockAttempted = true;
  try {
    screen.orientation?.lock?.('landscape')?.catch(() => {
      // unsupported outside an installed PWA; the rotate overlay is the fallback
    });
  } catch {
    // synchronous throw on some browsers; ignore for the same reason
  }
}
