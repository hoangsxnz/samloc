<script lang="ts">
  import { fanLayout, FAN_BASE_TOP } from '../lib/table-layout';
  import PlayingCard from './playing-card.svelte';

  interface Props {
    hand: string[];
    selected: string[];
    ontoggle: (id: string) => void;
  }

  let { hand, selected, ontoggle }: Props = $props();

  const positions = $derived(fanLayout(hand.length));
</script>

<div class="hand-fan">
  {#each hand as id, i (id)}
    {@const pos = positions[i]}
    {@const isSelected = selected.includes(id)}
    {#if pos}
      <button
        type="button"
        class="fan-slot"
        style="left:{pos.left}px; top:{FAN_BASE_TOP}px; transform: rotate({pos.rotate}deg) translateY({isSelected
          ? -20
          : pos.top - FAN_BASE_TOP}px); z-index:{i + 1};"
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
    transition: transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
</style>
