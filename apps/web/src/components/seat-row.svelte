<script lang="ts">
  import type { SeatView } from '@samloc/worker/ws-types';

  interface Props {
    seat: SeatView | null;
    isMe: boolean;
  }

  let { seat, isMe }: Props = $props();

  function initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }
</script>

{#if seat}
  <div class="seat" class:me={isMe}>
    <div class="seat-avatar">{initial(seat.name)}</div>
    <div class="seat-name">
      {seat.name}
      {#if seat.isHost}<span class="seat-crown" aria-hidden="true">♛</span>{/if}
      {#if isMe}<small>Bạn</small>{/if}
    </div>
    {#if !seat.connected}
      <span class="seat-status status-off">⟳ Mất kết nối</span>
    {:else if seat.isHost}
      <span class="seat-status status-ok">Chủ phòng</span>
    {:else if seat.ready}
      <span class="seat-status status-ok">Sẵn sàng</span>
    {:else}
      <span class="seat-status status-no">Chưa sẵn sàng</span>
    {/if}
  </div>
{:else}
  <div class="seat seat-empty">
    <div class="seat-avatar">+</div>
    <div class="seat-name seat-empty-label">Đang chờ người chơi…</div>
  </div>
{/if}

<style>
  .seat {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    padding: var(--sp-2) var(--sp-3);
    min-height: 56px;
  }
  .seat.me {
    border-color: var(--gold);
  }
  .seat-empty {
    border-style: dashed;
    background: transparent;
    color: var(--text-muted);
  }
  .seat-avatar {
    width: 40px;
    height: 40px;
    border-radius: var(--r-full);
    background: var(--surface-2);
    border: 2px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    flex-shrink: 0;
  }
  .seat-empty .seat-avatar {
    border-style: dashed;
    background: transparent;
  }
  .seat-name {
    flex: 1;
    font-size: var(--fs-md);
    font-weight: 600;
  }
  .seat-name small {
    display: block;
    font-size: var(--fs-xs);
    font-weight: 400;
    color: var(--text-muted);
  }
  .seat-empty-label {
    color: var(--text-muted);
    font-weight: 400;
  }
  .seat-crown {
    color: var(--gold);
    font-size: var(--fs-sm);
    margin-left: 4px;
  }
  .seat-status {
    font-size: var(--fs-xs);
    font-weight: 600;
    border-radius: var(--r-full);
    padding: 5px 10px;
    white-space: nowrap;
  }
  .status-ok {
    background: rgba(34, 197, 94, 0.15);
    color: var(--success);
    border: 1px solid rgba(34, 197, 94, 0.4);
  }
  .status-no {
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-muted);
    border: 1px solid var(--line);
  }
  .status-off {
    background: rgba(245, 158, 11, 0.15);
    color: var(--warn);
    border: 1px solid rgba(245, 158, 11, 0.4);
  }
</style>
