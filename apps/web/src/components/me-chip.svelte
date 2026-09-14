<script lang="ts">
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
  }

  let { name, isMyTurn, remain, turnSeconds, invalidReason, denWarn, tags }: Props = $props();

  function initial(value: string): string {
    return value.trim().charAt(0).toUpperCase() || '?';
  }

  const subLine = $derived(invalidReason ?? (denWarn ? 'Có thể phải đền bài' : null));
</script>

<div class="me-chip">
  <div class="me-avatar" class:active={isMyTurn}>{initial(name)}</div>
  <div class="me-label">
    {isMyTurn ? 'Lượt của bạn' : 'Chờ lượt'}
    {#if subLine}<small class:warn={!!invalidReason || denWarn}>{subLine}</small>{/if}
  </div>
  {#if isMyTurn}
    <TimerRing {remain} {turnSeconds} />
  {/if}
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
  }
  .me-avatar.active {
    border-color: var(--gold);
    box-shadow: 0 0 0 5px rgba(212, 175, 55, 0.25);
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
  .me-tag-queue {
    position: absolute;
    top: 100%;
    left: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
</style>
