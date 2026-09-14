<script lang="ts">
  import type { ResultRow } from '@samloc/worker/ws-types';
  import PlayingCard from '../../components/playing-card.svelte';

  interface Props {
    row: ResultRow;
    isWinner: boolean;
  }

  let { row, isWinner }: Props = $props();

  function initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }
</script>

<div class="result-row">
  <span class="result-av">{initial(row.name)}</span>
  <div class="result-name">
    {row.name}
    {#if row.cong}<i>Cóng</i>{/if}
  </div>
  <div class="result-net" class:pos={row.deltaLa >= 0} class:neg={row.deltaLa < 0}>
    {row.deltaLa >= 0 ? '+' : ''}{row.deltaLa}
  </div>
  <div class="result-cards">
    {#if isWinner}
      <i>Hết bài</i>
    {:else}
      {#each row.cards as id (id)}<PlayingCard {id} size="xs" />{/each}
    {/if}
  </div>
  <div class="result-total">
    Tổng phiên
    <b class:pos={row.totalLa >= 0} class:neg={row.totalLa < 0}>{row.totalLa >= 0 ? '+' : ''}{row.totalLa}</b>
  </div>
</div>

<style>
  .result-row {
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    padding: 8px 10px;
    display: grid;
    grid-template-columns: 32px 1fr auto;
    gap: 2px 8px;
    align-items: center;
  }
  .result-av {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--surface-2);
    border: 2px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
    grid-row: span 2;
  }
  .result-name {
    font-size: var(--fs-sm);
    font-weight: 600;
  }
  .result-name i {
    font-style: normal;
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 400;
    margin-left: 6px;
  }
  .result-net {
    font-size: var(--fs-md);
    font-weight: 700;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .result-cards {
    display: flex;
    align-items: center;
    height: 32px;
  }
  .result-cards i {
    font-style: normal;
    font-size: 11px;
    color: var(--text-muted);
  }
  .result-cards :global(.card-xs) {
    margin-left: -7px;
  }
  .result-cards :global(.card-xs:first-child) {
    margin-left: 0;
  }
  .result-total {
    font-size: 11px;
    color: var(--text-muted);
    text-align: right;
    white-space: nowrap;
  }
  .pos {
    color: var(--success);
  }
  .neg {
    color: #f87171;
  }
</style>
