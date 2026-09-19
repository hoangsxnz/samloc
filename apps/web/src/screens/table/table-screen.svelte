<script lang="ts">
  import { onMount } from 'svelte';
  import ConfirmDialog from '../../components/confirm-dialog.svelte';
  import ErrorToast from '../../components/error-toast.svelte';
  import TableMenuSheet from '../../components/table-menu-sheet.svelte';
  import { room } from '../../lib/room.svelte';
  import { go, route } from '../../lib/router.svelte';
  import { tableScale } from '../../lib/table-layout';
  import HandResultModal from './hand-result-modal.svelte';
  import { TableLogic } from './table-logic.svelte';
  import TableSurface from './table-surface.svelte';

  const code = $derived(route.params.code ?? '');
  const logic = new TableLogic();

  // position:fixed overlays must live outside .table-root: its CSS transform makes it their
  // containing block, which would scale and clip them instead of covering the real viewport.
  let menuOpen = $state(false);
  let confirmingSam = $state(false);

  /** The result modal waits so the winning combo is actually seen; a tap skips the wait. */
  const RESULT_DELAY_MS = 1800;
  let resultVisible = $state(false);
  let resultCollapsed = $state(false);

  function declareSam(): void {
    room.declareSam();
    confirmingSam = false;
  }

  // Keyed on the code so navigating between two rooms without leaving the route still reconnects.
  $effect(() => {
    room.connect(code);
  });

  $effect(() => {
    if (room.view?.status === 'waiting') go(`#/room/${code}`);
  });

  $effect(() => {
    if (room.view?.status !== 'hand-end' || !room.view.result) {
      resultVisible = false;
      resultCollapsed = false;
      return;
    }
    const timer = setTimeout(() => (resultVisible = true), RESULT_DELAY_MS);
    return () => clearTimeout(timer);
  });

  let scale = $state(1);
  function updateScale(): void {
    scale = tableScale(window.innerHeight, window.innerWidth);
  }
  onMount(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  });

  const view = $derived(room.view);
</script>

{#if view}
  <div class="table-wrapper">
    <TableSurface
      {view}
      {logic}
      {scale}
      onmenu={() => (menuOpen = true)}
      onbaosam={() => (confirmingSam = true)}
      onshowresult={resultCollapsed ? () => (resultCollapsed = false) : null}
    />
  </div>

  {#if view.status === 'hand-end' && view.result}
    {#if resultVisible && !resultCollapsed}
      <HandResultModal
        result={view.result}
        seats={view.seats}
        youSeat={view.youSeat}
        youAreHost={view.youAreHost}
        oncollapse={() => (resultCollapsed = true)}
      />
    {:else if !resultVisible}
      <button type="button" class="result-skip" aria-label="Xem kết quả" onclick={() => (resultVisible = true)}
      ></button>
    {/if}
  {/if}

  {#if menuOpen}
    <TableMenuSheet status={view.status} onclose={() => (menuOpen = false)} />
  {/if}

  {#if confirmingSam}
    <ConfirmDialog
      title="Báo Sâm?"
      body="Thua đền 20 lá/người"
      confirmLabel="Báo Sâm"
      onconfirm={declareSam}
      oncancel={() => (confirmingSam = false)}
    />
  {/if}
{:else}
  <div class="screen centered-screen connecting">
    <p>{room.ws.failed ? 'Không thể kết nối tới bàn chơi' : 'Đang kết nối bàn chơi…'}</p>
    <button type="button" class="btn btn-secondary" onclick={() => room.leave()}>Về sảnh</button>
  </div>
{/if}

<div class="visually-hidden" aria-live="polite">{logic.ariaLive}</div>

<ErrorToast message={room.lastError} onclear={() => room.clearError()} />

<style>
  .connecting {
    flex-direction: column;
    gap: var(--sp-4);
    color: var(--text-muted);
  }
  .connecting .btn {
    width: 200px;
  }
  .table-wrapper {
    height: 100dvh;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* Invisible catcher over the table during the result delay: a tap anywhere shows the modal now. */
  .result-skip {
    position: fixed;
    inset: 0;
    border: 0;
    padding: 0;
    background: transparent;
    cursor: pointer;
    z-index: 40;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
