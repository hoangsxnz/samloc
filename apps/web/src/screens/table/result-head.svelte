<script lang="ts">
  import type { HandResult } from '@samloc/worker/ws-types';

  interface Props {
    result: HandResult;
    winnerName: string;
    youWon: boolean;
  }

  let { result, winnerName, youWon }: Props = $props();

  function initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }
</script>

<header class="result-head">
  <h1 id="result-title">{result.kind === 'normal' ? `Kết quả ván ${result.handNo}` : result.headline}</h1>
  {#if result.winnerSeat !== null}
    <div class="result-winner">
      <span class="result-winner-av">{initial(winnerName)}</span>
      <b>{winnerName} thắng</b>
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
  .result-celebrate {
    width: 100%;
    margin: 0;
    font-size: var(--fs-md);
    font-weight: 700;
    color: var(--gold);
  }
</style>
