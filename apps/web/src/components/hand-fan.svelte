<script lang="ts">
  import { fanLayout, FAN_BASE_TOP } from '../lib/table-layout';
  import PlayingCard from './playing-card.svelte';

  interface Props {
    hand: string[];
    selected: string[];
    /** Cards that belong to at least one legal play; empty off-turn. */
    playable: Set<string>;
    ontoggle: (id: string) => void;
  }

  let { hand, selected, playable, ontoggle }: Props = $props();

  const lefts = $derived(fanLayout(hand.length));
</script>

<div class="hand-fan">
  {#each hand as id, i (id)}
    {@const left = lefts[i]}
    {@const isSelected = selected.includes(id)}
    {#if left !== undefined}
      <button
        type="button"
        class="fan-slot"
        class:hint={playable.has(id)}
        style="left:{left}px; top:{FAN_BASE_TOP}px; transform: translateY({isSelected ? -20 : 0}px); z-index:{i + 1};"
        onclick={() => ontoggle(id)}
        aria-pressed={isSelected}
        aria-label="{isSelected ? 'Bỏ chọn' : 'Chọn'} lá {id}"
      >
        <PlayingCard {id} size="lg" selected={isSelected} />
      </button>
    {/if}
  {/each}
</div>

<style>
  .hand-fan {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .fan-slot {
    position: absolute;
    width: 56px;
    height: 80px;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
    pointer-events: auto;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    border-radius: 6px;
    transition: transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  /* Playable cards are outlined, never dimmed: the hint adds, it does not take away. */
  .fan-slot.hint {
    box-shadow: 0 0 0 2px var(--gold), 0 0 10px rgba(212, 175, 55, 0.5);
  }
</style>
