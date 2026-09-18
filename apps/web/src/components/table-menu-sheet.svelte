<script lang="ts">
  import type { RoomStatus } from '@samloc/worker/ws-types';
  import { room } from '../lib/room.svelte';
  import { sound } from '../lib/sound.svelte';
  import { FELT_ORDER, FELT_PRESETS, tableTheme } from '../lib/table-theme.svelte';
  import ConfirmDialog from './confirm-dialog.svelte';

  interface Props {
    status: RoomStatus;
    onclose: () => void;
  }

  let { status, onclose }: Props = $props();

  let confirming = $state(false);

  function requestLeave(): void {
    if (status === 'playing') {
      confirming = true;
    } else {
      room.leave();
    }
  }
</script>

<div class="sheet-overlay">
  <button type="button" class="scrim-backdrop" aria-label="Đóng menu" onclick={onclose}></button>
  <div class="panel menu-sheet" role="dialog" aria-modal="true" aria-label="Menu bàn chơi">
    <div class="felt-picker" role="group" aria-label="Màu bàn">
      {#each FELT_ORDER as key (key)}
        <button
          type="button"
          class="felt-swatch"
          class:active={tableTheme.felt === key}
          style="background:{FELT_PRESETS[key].felt};"
          aria-label={FELT_PRESETS[key].label}
          aria-pressed={tableTheme.felt === key}
          onclick={() => tableTheme.set(key)}
        ></button>
      {/each}
    </div>
    <button type="button" class="btn btn-secondary" aria-pressed={sound.enabled} onclick={() => sound.set(!sound.enabled)}>
      {sound.enabled ? 'Âm thanh: Bật' : 'Âm thanh: Tắt'}
    </button>
    <button type="button" class="btn btn-danger" onclick={requestLeave}>Rời phòng</button>
  </div>
</div>

{#if confirming}
  <ConfirmDialog
    title="Rời phòng?"
    body="Rời giữa ván sẽ bị tính cóng/đếm lá"
    confirmLabel="Rời phòng"
    danger
    onconfirm={() => room.leave()}
    oncancel={() => (confirming = false)}
  />
{/if}

<style>
  .sheet-overlay {
    position: fixed;
    inset: 0;
    z-index: 60;
  }
  .scrim-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    border: 0;
    padding: 0;
    cursor: default;
  }
  .menu-sheet {
    position: absolute;
    top: var(--sp-4);
    right: var(--sp-4);
    width: 200px;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .felt-picker {
    display: flex;
    gap: var(--sp-2);
  }
  .felt-swatch {
    width: 36px;
    height: 28px;
    border-radius: var(--r-sm);
    border: 2px solid var(--line);
    cursor: pointer;
    padding: 0;
  }
  .felt-swatch.active {
    border-color: var(--gold);
  }
</style>
