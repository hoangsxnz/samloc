<script lang="ts">
  import type { ResultRow } from '@samloc/worker/ws-types';
  import Avatar from '../../components/avatar.svelte';
  import PlayingCard from '../../components/playing-card.svelte';
  import { formatMoney, formatMoneyDelta } from '../../lib/format-money';

  interface Props {
    row: ResultRow;
    isWinner: boolean;
    userId: string;
    avatarVer: number | null;
  }

  let { row, isWinner, userId, avatarVer }: Props = $props();
</script>

<div class="result-row">
  <span class="result-av"><Avatar name={row.name} {userId} {avatarVer} size={24} /></span>
  <div class="result-name">
    {row.name}
    {#if row.cong}<i>Cóng</i>{/if}
  </div>
  <div class="result-net" class:pos={row.deltaLa >= 0} class:neg={row.deltaLa < 0}>
    {formatMoneyDelta(row.deltaMoney)}
  </div>
  <div class="result-cards">
    {#if isWinner}
      <i>Hết bài</i>
    {:else}
      {#each row.cards as id (id)}<PlayingCard {id} size="xs" />{/each}
    {/if}
  </div>
  <div class="result-total">{formatMoney(row.moneyAfter)}</div>
</div>

<style>
  .result-row {
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    padding: 4px 8px;
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) auto;
    gap: 2px 6px;
    align-items: center;
  }
  .result-av {
    width: 28px;
    height: 28px;
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
    font-size: var(--fs-sm);
    font-weight: 700;
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  /* Tighter overlap and no wrapping: ten cards must still fit one column of the result grid. */
  .result-cards {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    height: 28px;
    min-width: 0;
  }
  .result-cards i {
    font-style: normal;
    font-size: 11px;
    color: var(--text-muted);
  }
  .result-cards :global(.card-xs) {
    margin-left: -14px;
    flex-shrink: 0;
  }
  .result-cards :global(.card-xs:first-child) {
    margin-left: 0;
  }
  .result-total {
    font-size: 11px;
    color: var(--text-muted);
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .pos {
    color: var(--success);
  }
  .neg {
    color: #f87171;
  }
</style>
