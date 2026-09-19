<script lang="ts">
  import type { Combo } from '@samloc/rules';

  interface Props {
    currentCombo: Combo | null;
    canPlay: boolean;
    isMyTurn: boolean;
    /** Set while this seat still has to press Huỷ báo or Báo Sâm; `canDeclare` drops once a lower seat declared. */
    samDecision: { remain: number; canDeclare: boolean } | null;
    canSort: boolean;
    onplay: () => void;
    onpass: () => void;
    onbaosam: () => void;
    ondecline: () => void;
    onsort: () => void;
  }

  let { currentCombo, canPlay, isMyTurn, samDecision, canSort, onplay, onpass, onbaosam, ondecline, onsort }: Props =
    $props();

  /** Leading seat must play; passing is only ever an option against a live combo. */
  const canPass = $derived(isMyTurn && currentCombo !== null);
</script>

<!-- Right column, clear of the hand fan (which ends at x 544 in the 844px frame). Rare and
     utility actions stack above the two play actions, which keep the bottom-right thumb zone. -->
<div class="action-column">
  {#if samDecision}
    <div class="sam-row">
      <span class="sam-count">Báo sâm? {Math.ceil(samDecision.remain)}s</span>
      <button type="button" class="btn btn-secondary sam-decline" onclick={ondecline}>Huỷ báo</button>
      <button type="button" class="sam-pill" disabled={!samDecision.canDeclare} onclick={onbaosam}>Báo Sâm</button>
    </div>
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
  .sam-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sam-count {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .sam-decline {
    width: auto;
    height: 36px;
    padding: 0 14px;
    border-radius: var(--r-full);
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
  .sam-pill:disabled {
    opacity: 0.4;
    box-shadow: none;
    cursor: default;
  }
</style>
