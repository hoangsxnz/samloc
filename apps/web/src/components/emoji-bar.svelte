<script lang="ts">
  import type { EmojiKey } from '@samloc/worker/ws-types';
  import { EMOJI_GLYPHS, EMOJI_LABELS, EMOJI_ORDER } from '../lib/emoji-glyphs';

  interface Props {
    onpick: (key: EmojiKey) => void;
  }

  let { onpick }: Props = $props();

  let open = $state(false);
  let barEl = $state<HTMLDivElement | null>(null);

  function pick(key: EmojiKey): void {
    onpick(key);
    open = false;
  }

  /** Closes on any tap outside the bar; a tap inside is left to the buttons' own handlers. */
  function onWindowPointerDown(event: PointerEvent): void {
    if (!open) return;
    if (!barEl?.contains(event.target as Node)) open = false;
  }
</script>

<svelte:window onpointerdown={onWindowPointerDown} />

<div class="emoji-bar" bind:this={barEl}>
  <button
    type="button"
    class="emoji-trigger"
    aria-label="Gửi biểu cảm"
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    🙂
  </button>
  {#if open}
    <div class="emoji-row" role="group" aria-label="Biểu cảm">
      {#each EMOJI_ORDER as key (key)}
        <button type="button" class="emoji-pick" aria-label={EMOJI_LABELS[key]} onclick={() => pick(key)}>
          {EMOJI_GLYPHS[key]}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .emoji-bar {
    position: absolute;
    top: 248px;
    left: max(40px, env(safe-area-inset-left));
    display: flex;
    align-items: center;
    gap: 6px;
    z-index: 20;
  }
  .emoji-trigger {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--surface-2);
    border: 1.5px solid var(--line);
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    flex-shrink: 0;
  }
  .emoji-row {
    display: flex;
    gap: 2px;
    padding: 2px 4px;
    border-radius: var(--r-full);
    background: rgba(0, 0, 0, 0.55);
    border: 1px solid var(--line);
  }
  .emoji-pick {
    width: 44px;
    height: 44px;
    background: none;
    border: none;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
  }
  .emoji-pick:active {
    transform: scale(1.2);
  }
</style>
