<script lang="ts">
  import type { RoomStatus } from '@samloc/worker/ws-types';
  import { room } from '../lib/room.svelte';
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
</style>
