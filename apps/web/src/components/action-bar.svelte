<script lang="ts">
  import type { Combo } from '@samloc/rules';

  interface Props {
    currentCombo: Combo | null;
    canPlay: boolean;
    isMyTurn: boolean;
    canDeclareSam: boolean;
    canSort: boolean;
    onplay: () => void;
    onpass: () => void;
    onbaosam: () => void;
    onsort: () => void;
  }

  let { currentCombo, canPlay, isMyTurn, canDeclareSam, canSort, onplay, onpass, onbaosam, onsort }: Props = $props();

  /** Leading seat must play; passing is only ever an option against a live combo. */
  const canPass = $derived(isMyTurn && currentCombo !== null);
</script>

<!-- Right column, clear of the hand fan (which ends at x 544 in the 844px frame). Rare and
     utility actions stack above the two play actions, which keep the bottom-right thumb zone. -->
<div class="action-column">
  {#if canDeclareSam}
    <button type="button" class="sam-pill" onclick={onbaosam}>Báo Sâm</button>
  {/if}
  <button type="button" class="btn btn-secondary sort-btn" disabled={!canSort} onclick={onsort}>Xếp bài</button>
  <div class="play-row">
    <button type="button" class="btn btn-secondary bar-btn bar-pass" disabled={!canPass} onclick={onpass}>
      Bỏ lượt
    </button>
    <button type="button" class="btn btn-primary bar-btn bar-play" disabled={!canPlay} onclick={onplay}>
      Đánh
    </button>
  </div>
</div>

<style>
  .action-column {
    position: absolute;
    right: max(40px, env(safe-area-inset-right));
    bottom: max(20px, env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    z-index: 20;
  }
  .play-row {
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
  .sort-btn {
    width: 96px;
    height: 36px;
    border-radius: var(--r-md);
    font-size: 14px;
  }
  .sam-pill {
    height: 36px;
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
