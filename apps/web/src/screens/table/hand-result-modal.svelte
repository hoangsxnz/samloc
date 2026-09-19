<script lang="ts">
  import type { HandResult, SeatView } from '@samloc/worker/ws-types';
  import AppButton from '../../components/app-button.svelte';
  import { formatMoney } from '../../lib/format-money';
  import { room } from '../../lib/room.svelte';
  import ResultHead from './result-head.svelte';
  import ResultRow from './result-row.svelte';

  interface Props {
    result: HandResult;
    seats: SeatView[];
    youSeat: number;
    youAreHost: boolean;
  }

  let { result, seats, youSeat, youAreHost }: Props = $props();

  let collapsed = $state(false);
  let showSessionBoard = $state(false);

  const winner = $derived(seats.find((s) => s.seat === result.winnerSeat) ?? null);
  const nextLeadName = $derived(seats.find((s) => s.seat === result.nextLeadSeat)?.name ?? '');

  function tapScrim(): void {
    if (!youAreHost) collapsed = true;
  }
</script>

{#if collapsed}
  <button type="button" class="result-chip" onclick={() => (collapsed = false)}>Kết quả</button>
{:else}
  <div class="result-overlay">
    <button type="button" class="scrim-backdrop" aria-label="Xem lại bàn chơi" onclick={tapScrim}></button>
    <div class="panel result-modal" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <ResultHead {result} {winner} youWon={result.winnerSeat === youSeat} />

      <div class="result-grid">
        {#each result.rows as row (row.seat)}
          {@const seat = seats.find((s) => s.seat === row.seat)}
          <ResultRow {row} isWinner={row.seat === result.winnerSeat} userId={seat?.userId ?? ''} avatarVer={seat?.avatarVer ?? null} />
        {/each}
      </div>

      {#if showSessionBoard}
        <div class="session-board">
          {#each seats as seat (seat.seat)}
            <span>{seat.name}: {formatMoney(seat.money)}</span>
          {/each}
        </div>
      {/if}

      <footer class="result-foot">
        <AppButton variant="ghost" onclick={() => (showSessionBoard = !showSessionBoard)}>
          Bảng điểm phiên
        </AppButton>
        <p class="result-status">
          <span>{nextLeadName} cầm cái ván sau</span>
          {#if !youAreHost}<span>Đang chờ chủ phòng bắt đầu ván mới…</span>{/if}
        </p>
        <AppButton variant="danger" onclick={() => room.leave()}>Rời phòng</AppButton>
        {#if youAreHost}
          <AppButton onclick={() => room.nextHand()}>Ván tiếp</AppButton>
        {/if}
      </footer>
    </div>
  </div>
{/if}

<style>
  .result-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
  }
  .scrim-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    border: 0;
    padding: 0;
    cursor: default;
    animation: result-scrim-in 150ms ease-out;
  }
  .result-modal {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(640px, calc(100vw - 32px));
    height: auto;
    max-height: calc(100dvh - 32px);
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    border-radius: var(--r-lg);
    animation: result-modal-in 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  @keyframes result-scrim-in {
    from { opacity: 0; }
  }
  @keyframes result-modal-in {
    from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }
  /* auto-fit gives two columns at 640px: 2 players on one row, 5 players on three, so nothing scrolls. */
  .result-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--sp-2);
    min-height: 0;
    overflow-y: auto;
  }
  .session-board {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    font-size: var(--fs-xs);
    color: var(--text-muted);
  }
  .result-foot {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  /* Buttons keep their natural width (the shared .btn is 100% wide) so the status gets the rest. */
  .result-foot :global(.btn) {
    width: auto;
    height: 40px;
    padding: 0 var(--sp-4);
    font-size: var(--fs-sm);
    flex-shrink: 0;
  }
  /* One horizontal line: the status used to stack vertically when squeezed as a narrow flex item. */
  .result-status {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    justify-content: flex-end;
    gap: var(--sp-3);
    white-space: nowrap;
    overflow: hidden;
    font-size: var(--fs-xs);
    color: var(--text-muted);
    margin: 0;
  }
  .result-status span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .result-chip {
    position: fixed;
    top: max(8px, env(safe-area-inset-top));
    right: max(40px, env(safe-area-inset-right));
    z-index: 50;
    height: 32px;
    padding: 0 14px;
    border-radius: var(--r-full);
    background: var(--gold);
    color: var(--on-gold);
    font-weight: 700;
    font-size: 13px;
    border: 0;
    cursor: pointer;
  }
</style>
