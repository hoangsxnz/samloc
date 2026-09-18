<script lang="ts">
  import type { HandResult, SeatView } from '@samloc/worker/ws-types';
  import Avatar from '../../components/avatar.svelte';

  interface Props {
    result: HandResult;
    /** Null when the winning seat has already left the room. */
    winner: SeatView | null;
    youWon: boolean;
  }

  let { result, winner, youWon }: Props = $props();
</script>

<header class="result-head">
  <h1 id="result-title">{result.kind === 'normal' ? `Kết quả ván ${result.handNo}` : result.headline}</h1>
  {#if result.winnerSeat !== null}
    <div class="result-winner">
      <span class="result-winner-av">
        <Avatar name={winner?.name ?? ''} userId={winner?.userId ?? ''} avatarVer={winner?.avatarVer ?? null} size={28} />
      </span>
      <b>{winner?.name ?? ''} thắng</b>
    </div>
  {/if}
  {#if youWon}<p class="result-celebrate">Mừng cậu chủ thắng lớn 💕</p>{/if}
</header>

<style>
  .result-head {
    display: flex;
    flex-wrap: wrap;
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
    display: flex;
    border-radius: 50%;
    border: 2px solid var(--gold);
  }
  .result-winner b {
    font-size: 14px;
    color: var(--gold);
  }
  .result-celebrate {
    width: 100%;
    margin: 0;
    font-size: var(--fs-md);
    font-weight: 700;
    color: var(--gold);
  }
</style>
