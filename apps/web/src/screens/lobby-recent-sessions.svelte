<script lang="ts">
  import { api, type RecentSession } from '../lib/api';
  import { go } from '../lib/router.svelte';

  let sessions = $state<RecentSession[]>([]);
  let loading = $state(true);
  let selected = $state<RecentSession | null>(null);

  $effect(() => {
    api
      .recentSessions()
      .then((res) => {
        sessions = res.sessions;
      })
      .catch(() => {
        sessions = [];
      })
      .finally(() => {
        loading = false;
      });
  });

  function formatNet(entry: RecentSession): string {
    return entry.netScore > 0 ? `+${entry.netScore}` : `${entry.netScore}`;
  }
</script>

<ul class="recent-list">
  {#if loading}
    <li class="recent-empty">Đang tải…</li>
  {:else if sessions.length === 0}
    <li class="recent-empty">Chưa có ván nào</li>
  {/if}
  {#each sessions as entry (entry.code)}
    <li class="recent-row">
      <button type="button" class="recent-row-btn" onclick={() => (selected = entry)}>
        <span class="recent-code">{entry.code}</span>
        <span class="recent-meta">{entry.players.join(' · ')} · {entry.hands} ván</span>
        <span class="recent-net" class:pos={entry.netScore >= 0} class:neg={entry.netScore < 0}>
          {formatNet(entry)}
        </span>
      </button>
      {#if entry.open}
        <button type="button" class="btn btn-ghost recent-rejoin" onclick={() => go(`#/room/${entry.code}`)}>Vào lại</button>
      {/if}
    </li>
  {/each}
</ul>

{#if selected}
  <div class="score-sheet-scrim" role="dialog" aria-modal="true" aria-label={`Bảng điểm phòng ${selected.code}`}>
    <div class="panel score-sheet">
      <h3>Phòng {selected.code}</h3>
      <p>{selected.players.join(', ')}</p>
      <p>{selected.hands} ván · điểm ròng {formatNet(selected)}</p>
      <button type="button" class="btn btn-secondary" onclick={() => (selected = null)}>Đóng</button>
    </div>
  </div>
{/if}

<style>
  .recent-list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    min-height: 0;
    flex: 1;
  }
  .recent-empty {
    padding: var(--sp-3) 0;
    color: var(--text-muted);
    font-size: var(--fs-sm);
  }
  .recent-row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    border-bottom: 1px solid var(--line);
    min-height: 48px;
  }
  .recent-row-btn {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    background: none;
    border: 0;
    color: var(--text);
    text-align: left;
    padding: var(--sp-2) 0;
    cursor: pointer;
  }
  .recent-code {
    font-size: var(--fs-sm);
    font-weight: 700;
    letter-spacing: 0.06em;
    width: 64px;
    flex-shrink: 0;
  }
  .recent-meta {
    flex: 1;
    font-size: var(--fs-xs);
    color: var(--text-muted);
  }
  .recent-net {
    font-size: var(--fs-lg);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .recent-net.pos {
    color: var(--success);
  }
  .recent-net.neg {
    color: #f87171;
  }
  .recent-rejoin {
    width: auto;
    height: 32px;
    padding: 0 var(--sp-2);
  }
  .score-sheet-scrim {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--sp-4);
  }
  .score-sheet {
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .score-sheet h3 {
    margin: 0;
  }
</style>
