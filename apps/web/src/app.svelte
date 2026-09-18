<script lang="ts">
  import { onMount } from 'svelte';
  import OrientationOverlay from './components/orientation-overlay.svelte';
  import { room } from './lib/room.svelte';
  import { requestLandscapeLockOnce } from './lib/orientation.svelte';
  import { go, initRouter, route } from './lib/router.svelte';
  import { bootstrap, session } from './lib/session.svelte';
  import { sound } from './lib/sound.svelte';
  import LobbyScreen from './screens/lobby-screen.svelte';
  import LoginScreen from './screens/login-screen.svelte';
  import TableScreen from './screens/table/table-screen.svelte';
  import WaitingScreen from './screens/waiting-screen.svelte';

  onMount(() => {
    initRouter();
    void bootstrap();
    document.addEventListener('pointerdown', requestLandscapeLockOnce, { once: true });
    document.addEventListener('pointerdown', () => sound.unlock(), { once: true });
  });

  $effect(() => {
    if (route.name === 'lobby' || route.name === 'login') room.disconnect();
  });

  $effect(() => {
    if (session.loading) return;
    const isAuthed = !!session.user;
    if (!isAuthed && route.name !== 'login') go('#/login');
    else if (isAuthed && route.name === 'login') go('#/lobby');
  });

  const showReconnectBanner = $derived(
    (route.name === 'room' || route.name === 'table') && room.view !== null && !room.ws.connected,
  );
</script>

{#if showReconnectBanner}
  <div class="reconnect-banner" role="status">
    {#if room.ws.failed}
      Không kết nối lại được.
      <button type="button" class="banner-btn" onclick={() => room.leave()}>Về sảnh</button>
    {:else}
      Mất kết nối, đang kết nối lại…
    {/if}
  </div>
{/if}

<OrientationOverlay />

{#if session.loading}
  <div class="screen centered-screen">
    <p>Đang tải…</p>
  </div>
{:else if route.name === 'login'}
  <LoginScreen />
{:else if route.name === 'lobby'}
  <LobbyScreen />
{:else if route.name === 'room'}
  <WaitingScreen />
{:else if route.name === 'table'}
  <TableScreen />
{/if}

<style>
  .reconnect-banner {
    position: fixed;
    top: 0;
    left: max(40px, env(safe-area-inset-left));
    right: max(40px, env(safe-area-inset-right));
    z-index: 60;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--warn);
    color: var(--on-gold);
    font-size: var(--fs-sm);
    font-weight: 600;
    gap: var(--sp-3);
  }
  .banner-btn {
    height: 24px;
    padding: 0 10px;
    border: 1.5px solid var(--on-gold);
    border-radius: var(--r-full);
    background: transparent;
    color: var(--on-gold);
    font-size: var(--fs-xs);
    font-weight: 700;
    cursor: pointer;
  }
</style>
