<script lang="ts">
  import type { SeatView } from '@samloc/worker/ws-types';
  import { formatMoney } from '../lib/format-money';
  import type { Reaction } from '../lib/room.svelte';
  import EmojiBubble from './emoji-bubble.svelte';
  import EventTag from './event-tag.svelte';
  import TimerRing from './timer-ring.svelte';

  interface Props {
    seat: SeatView;
    pos: { left?: number; right?: number; top: number };
    active: boolean;
    remain: number;
    turnSeconds: number;
    tags: { id: number; text: string; tone: 'gold' | 'danger' | 'warn' | 'info' }[];
    reactions: Reaction[];
  }

  let { seat, pos, active, remain, turnSeconds, tags, reactions }: Props = $props();

  function initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }

  const displayName = $derived(seat.name.length > 8 ? `${seat.name.slice(0, 8)}…` : seat.name);
  const posStyle = $derived(
    `top:${pos.top}px;${pos.left !== undefined ? `left:${pos.left}px;` : ''}${pos.right !== undefined ? `right:${pos.right}px;` : ''}`,
  );
  const danger = $derived(active && remain < 5);
</script>

<div class="opp-seat" style={posStyle} class:passed={seat.passed} class:disconnected={!seat.connected}>
  <div class="opp-reactions">
    {#each reactions as reaction (reaction.id)}<EmojiBubble emoji={reaction.key} />{/each}
  </div>
  <!-- On the active seat the countdown replaces the initial and the arc wraps the avatar. -->
  <div class="opp-avatar-wrap">
    <div class="opp-avatar" class:active class:danger>{active ? Math.ceil(remain) : initial(seat.name)}</div>
    {#if active}
      <div class="opp-ring"><TimerRing {remain} {turnSeconds} size={48} stroke={3} digits={false} /></div>
    {/if}
  </div>
  <span class="opp-name">{displayName}</span>
  <div class="opp-count-row">
    <div class="opp-cardback" class:one={seat.cardCount === 1}>{seat.cardCount}</div>
    <span class="opp-money">{formatMoney(seat.money)}</span>
  </div>
  {#if !seat.connected}
    <span class="opp-tag">⟳</span>
  {:else if seat.passed}
    <span class="opp-tag">Bỏ</span>
  {:else if seat.bao1}
    <span class="opp-tag hot">Báo 1</span>
  {/if}
  <div class="opp-tag-queue">
    {#each tags as tag (tag.id)}<EventTag text={tag.text} tone={tag.tone} />{/each}
  </div>
</div>

<style>
  .opp-seat {
    position: absolute;
    width: 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-align: center;
  }
  .opp-avatar-wrap {
    position: relative;
    width: 40px;
    height: 40px;
  }
  .opp-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--surface-2);
    border: 2px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 15px;
    font-variant-numeric: tabular-nums;
  }
  .opp-avatar.active {
    border-color: var(--gold);
  }
  .opp-avatar.danger {
    color: var(--danger);
    animation: opp-digit-pulse 500ms ease-in-out infinite;
  }
  .opp-ring {
    position: absolute;
    inset: -4px;
    pointer-events: none;
  }
  .disconnected .opp-avatar {
    border-color: var(--text-muted);
  }
  .passed .opp-avatar {
    opacity: 0.5;
  }
  .opp-name {
    font-size: 12px;
    font-weight: 600;
    max-width: 80px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    /* Tight: the seat column must end above the played-card stack at y 160. */
    line-height: 13px;
  }
  .opp-count-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .opp-cardback {
    width: 28px;
    height: 38px;
    border-radius: 5px;
    background: var(--card-back);
    border: 1.5px solid rgba(255, 255, 255, 0.55);
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }
  .opp-cardback.one {
    border-color: var(--danger);
    background: var(--danger);
  }
  .opp-money {
    font-size: 10px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .opp-tag {
    font-size: 10px;
    font-weight: 700;
    border-radius: var(--r-full);
    padding: 1px 6px;
    background: rgba(0, 0, 0, 0.45);
    color: var(--text-muted);
    line-height: 13px;
  }
  .opp-tag.hot {
    background: var(--danger);
    color: #fff;
  }
  /* Bubbles rise above the avatar; the event tags occupy the space below it. */
  .opp-reactions {
    position: absolute;
    bottom: 100%;
    display: flex;
    gap: 2px;
    pointer-events: none;
  }
  .opp-tag-queue {
    position: absolute;
    top: 100%;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  @keyframes opp-digit-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.15); }
  }
</style>
