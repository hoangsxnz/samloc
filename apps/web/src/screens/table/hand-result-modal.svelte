<script lang="ts">
  import type { HandResult, SeatView } from '@samloc/worker/ws-types';
  import AppButton from '../../components/app-button.svelte';
  import { room } from '../../lib/room.svelte';
  import ResultRow from './result-row.svelte';

  interface Props {
    result: HandResult;
    seats: SeatView[];
    youAreHost: boolean;
  }

  let { result, seats, youAreHost }: Props = $props();

  let collapsed = $state(false);
  let showSessionBoard = $state(false);

  const winnerName = $derived(
    result.winnerSeat !== null ? (seats.find((s) => s.seat === result.winnerSeat)?.name ?? '') : '',
  );
  const nextLeadName = $derived(seats.find((s) => s.seat === result.nextLeadSeat)?.name ?? '');

  function initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }

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
      <header class="result-head">
        <h1 id="result-title">{result.kind === 'normal' ? `Kết quả ván ${result.handNo}` : result.headline}</h1>
        {#if result.winnerSeat !== null}
          <div class="result-winner">
            <span class="result-winner-av">{initial(winnerName)}</span>
            <b>{winnerName} thắng</b>
          </div>
        {/if}
      </header>

      <div class="result-grid">
        {#each result.rows as row (row.seat)}
          <ResultRow {row} isWinner={row.seat === result.winnerSeat} />
        {/each}
      </div>

      <p class="result-next">{nextLeadName} cầm cái ván sau</p>

      {#if showSessionBoard}
        <div class="session-board">
          {#each seats as seat (seat.seat)}
            <span>{seat.name}: {seat.totalLa >= 0 ? '+' : ''}{seat.totalLa}</span>
          {/each}
        </div>
      {/if}

      <footer class="result-foot">
        <AppButton variant="ghost" onclick={() => (showSessionBoard = !showSessionBoard)}>
          Xem bảng điểm phiên
        </AppButton>
        {#if youAreHost}
          <AppButton onclick={() => room.nextHand()}>Ván tiếp</AppButton>
        {:else}
          <p class="result-waiting">Đang chờ chủ phòng bắt đầu ván mới…</p>
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
    width: 640px;
    max-width: calc(100vw - 32px);
    height: 330px;
    max-height: calc(100vh - 32px);
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
  .result-head {
    display: flex;
    align-items: baseline;
    gap: var(--sp-3);
  }
  .result-head h1 {
    font-size: var(--fs-xl);
    margin: 0;
  }
  .result-winner {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    background: rgba(212, 175, 55, 0.14);
    border: 1px solid rgba(212, 175, 55, 0.45);
    border-radius: var(--r-full);
    padding: 3px 12px 3px 4px;
  }
  .result-winner-av {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--gold);
    color: var(--on-gold);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
  }
  .result-winner b {
    font-size: 14px;
    color: var(--gold);
  }
  .result-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-2);
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  .result-next {
    text-align: center;
    font-size: var(--fs-xs);
    color: var(--text-muted);
    margin: 0;
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
  .result-waiting {
    flex: 1;
    text-align: right;
    font-size: var(--fs-xs);
    color: var(--text-muted);
    margin: 0;
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
