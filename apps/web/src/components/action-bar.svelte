<script lang="ts">
  import type { Combo } from '@samloc/rules';

  interface Props {
    currentCombo: Combo | null;
    canPlay: boolean;
    isMyTurn: boolean;
    canDeclareSam: boolean;
    onplay: () => void;
    onpass: () => void;
    onbaosam: () => void;
  }

  let { currentCombo, canPlay, isMyTurn, canDeclareSam, onplay, onpass, onbaosam }: Props = $props();
</script>

{#if canDeclareSam}
  <button type="button" class="sam-pill" onclick={onbaosam}>Báo Sâm</button>
{/if}

<div class="action-bar">
  {#if currentCombo !== null}
    <button type="button" class="btn btn-secondary bar-btn bar-pass" disabled={!isMyTurn} onclick={onpass}>
      Bỏ lượt
    </button>
  {/if}
  <button type="button" class="btn btn-primary bar-btn bar-play" disabled={!canPlay} onclick={onplay}>
    Đánh
  </button>
</div>

<style>
  .action-bar {
    position: absolute;
    right: max(40px, env(safe-area-inset-right));
    bottom: max(20px, env(safe-area-inset-bottom));
    display: flex;
    gap: 10px;
  }
  .bar-btn {
    width: auto;
    height: 48px;
    border-radius: var(--r-md);
    font-size: 16px;
  }
  .bar-pass {
    width: 96px;
  }
  .bar-play {
    width: 120px;
  }
  .sam-pill {
    position: absolute;
    right: max(40px, env(safe-area-inset-right));
    bottom: 84px;
    height: 40px;
    padding: 0 18px;
    border-radius: var(--r-full);
    background: rgba(18, 56, 34, 0.9);
    border: 1.5px solid var(--gold);
    color: var(--gold);
    font-weight: 700;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 0 16px rgba(212, 175, 55, 0.45);
    cursor: pointer;
  }
</style>
