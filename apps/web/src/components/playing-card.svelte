<script lang="ts">
  import { rankLabel, suitColour, suitGlyph } from '../lib/card-view';

  interface Props {
    id?: string;
    back?: boolean;
    size: 'lg' | 'sm' | 'xs';
    count?: number;
    selected?: boolean;
  }

  let { id, back = false, size, count, selected = false }: Props = $props();

  const colour = $derived(id ? suitColour(id) : 'black');
</script>

{#if back}
  <div class="card card-back card-{size}">
    {#if count !== undefined}
      <span class="card-count" class:card-count-low={count === 1}>{count}</span>
    {/if}
  </div>
{:else if id}
  <div class="card card-face card-{size} card-{colour}" class:card-selected={selected}>
    <span class="card-rank">{rankLabel(id)}</span>
    <span class="card-suit-small" aria-hidden="true">{suitGlyph(id)}</span>
    <span class="card-suit-centre" aria-hidden="true">{suitGlyph(id)}</span>
  </div>
{/if}

<style>
  .card {
    position: relative;
    border-radius: var(--r-card);
    border: 1px solid rgba(0, 0, 0, 0.15);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .card-face {
    background: var(--card-face);
    color: var(--card-black);
  }
  .card-face.card-red {
    color: var(--card-red);
  }
  .card-selected {
    outline: 2px solid var(--gold);
    outline-offset: 1px;
  }
  .card-back {
    background-color: var(--card-back);
    background-image:
      repeating-linear-gradient(45deg, transparent 0 3px, rgba(255, 255, 255, 0.3) 3px 4px),
      repeating-linear-gradient(-45deg, transparent 0 3px, rgba(255, 255, 255, 0.3) 3px 4px);
    box-shadow:
      inset 0 0 0 4px rgba(255, 255, 255, 0.85),
      0 2px 6px rgba(0, 0, 0, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card-count {
    color: #fff;
    font-size: 15px;
    font-weight: 700;
  }
  .card-count-low {
    color: var(--danger);
  }

  .card-lg {
    width: 56px;
    height: 80px;
  }
  .card-lg .card-rank {
    position: absolute;
    top: 3px;
    left: 5px;
    font-size: 22px;
    line-height: 1;
  }
  .card-lg .card-suit-small {
    position: absolute;
    top: 25px;
    left: 6px;
    font-size: 18px;
    line-height: 1;
  }
  /* Anchored to the bottom-right quadrant so its box never meets the top-left
     rank + suit block; wide glyphs (hearts, diamonds) used to fuse with it. */
  .card-lg .card-suit-centre {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    font-size: 30px;
    padding: 0 6px 4px 0;
  }

  .card-sm {
    width: 44px;
    height: 62px;
    border-radius: 5px;
  }
  .card-sm .card-rank {
    position: absolute;
    top: 3px;
    left: 4px;
    font-size: 16px;
    line-height: 1;
  }
  .card-sm .card-suit-small {
    position: absolute;
    top: 19px;
    left: 5px;
    font-size: 12px;
    line-height: 1;
  }
  .card-sm .card-suit-centre {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    font-size: 22px;
    padding: 0 5px 3px 0;
  }

  .card-xs {
    width: 24px;
    height: 32px;
    border-radius: 3px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .card-xs .card-rank {
    font-size: 11px;
    line-height: 1;
  }
  .card-xs .card-suit-small {
    font-size: 9px;
    line-height: 1;
  }
  .card-xs .card-suit-centre {
    display: none;
  }
</style>
