<script lang="ts">
  import type { Reaction } from '../lib/room.svelte';
  import EmojiBubble from './emoji-bubble.svelte';
  import EventTag from './event-tag.svelte';
  import TimerRing from './timer-ring.svelte';

  interface Props {
    name: string;
    isMyTurn: boolean;
    remain: number;
    turnSeconds: number;
    invalidReason: string | null;
    denWarn: boolean;
    tags: { id: number; text: string; tone: 'gold' | 'danger' | 'warn' | 'info' }[];
    reactions: Reaction[];
  }

  let { name, isMyTurn, remain, turnSeconds, invalidReason, denWarn, tags, reactions }: Props = $props();

  function initial(value: string): string {
    return value.trim().charAt(0).toUpperCase() || '?';
  }

  const subLine = $derived(invalidReason ?? (denWarn ? 'Có thể phải đền bài' : null));
  const danger = $derived(isMyTurn && remain < 5);
</script>

<div class="me-chip">
  <div class="me-reactions">
    {#each reactions as reaction (reaction.id)}<EmojiBubble emoji={reaction.key} />{/each}
  </div>
  <!-- On my turn the countdown replaces the initial and the arc wraps the avatar,
       matching the opponent seats and keeping the chip narrow enough for the fan. -->
  <div class="me-avatar-wrap">
    <div class="me-avatar" class:active={isMyTurn} class:danger>
      {isMyTurn ? Math.ceil(remain) : initial(name)}
    </div>
    {#if isMyTurn}
      <div class="me-ring"><TimerRing {remain} {turnSeconds} size={48} stroke={3} digits={false} /></div>
    {/if}
  </div>
  <div class="me-label">
    {isMyTurn ? 'Lượt của bạn' : 'Chờ lượt'}
    {#if subLine}<small class:warn={!!invalidReason || denWarn}>{subLine}</small>{/if}
  </div>
  <div class="me-tag-queue">
    {#each tags as tag (tag.id)}<EventTag text={tag.text} tone={tag.tone} />{/each}
  </div>
</div>

<style>
  .me-chip {
    position: absolute;
    top: 306px;
    left: max(40px, env(safe-area-inset-left));
    display: flex;
    align-items: center;
    gap: 10px;
    z-index: 20;
  }
  .me-avatar-wrap {
    position: relative;
    width: 40px;
    height: 40px;
  }
  .me-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--surface-2);
    border: 2px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 16px;
    font-variant-numeric: tabular-nums;
  }
  .me-avatar.active {
    border-color: var(--gold);
  }
  .me-avatar.danger {
    color: var(--danger);
    animation: me-digit-pulse 500ms ease-in-out infinite;
  }
  .me-ring {
    position: absolute;
    inset: -4px;
    pointer-events: none;
  }
  .me-label {
    font-size: 14px;
    font-weight: 600;
    line-height: 18px;
  }
  .me-label small {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--success);
  }
  .me-label small.warn {
    color: var(--danger);
  }
  /* Bubbles rise above the avatar; the event tags occupy the space below it. */
  .me-reactions {
    position: absolute;
    bottom: 100%;
    left: 0;
    display: flex;
    gap: 2px;
    pointer-events: none;
  }
  .me-tag-queue {
    position: absolute;
    top: 100%;
    left: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  @keyframes me-digit-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.15); }
  }
</style>
