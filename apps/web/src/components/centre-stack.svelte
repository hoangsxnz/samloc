<script lang="ts">
  import type { TrickEntry } from '@samloc/worker/ws-types';
  import { scatterFor } from '../lib/trick-scatter';
  import PlayingCard from './playing-card.svelte';

  interface Props {
    trick: TrickEntry[];
  }

  let { trick }: Props = $props();

  /** Each combo rests on its own hashed spot; older rows only fade, they never move. */
  function rowStyle(entry: TrickEntry, age: number): string {
    const { dx, dy, rot } = scatterFor(entry.seat, entry.cards);
    const opacity = age === 0 ? 1 : Math.max(0.3, 0.5 - (age - 1) * 0.08);
    return `opacity:${opacity}; transform: translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(${rot}deg);`;
  }
</script>

<div class="centre-stack">
  {#each trick as entry, i (i)}
    {@const isNewest = i === trick.length - 1}
    {@const age = trick.length - 1 - i}
    <div class="trick-row" class:newest={isNewest} style={rowStyle(entry, age)}>
      <div class="trick-cards">
        {#each entry.cards as id (id)}
          <PlayingCard {id} size="sm" />
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .centre-stack {
    position: absolute;
    top: 150px;
    left: 50%;
    transform: translateX(-50%);
    width: 240px;
    height: 100px;
    transition: opacity 350ms ease-in;
  }
  .centre-stack:empty {
    opacity: 0;
  }
  .trick-row {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    transition:
      opacity 200ms cubic-bezier(0.2, 0.8, 0.2, 1),
      transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  /* Fades in as the flight lands, so the flying copy and the real row never both read as solid. */
  .trick-row.newest {
    z-index: 1;
    animation: trick-land 260ms ease-out both;
  }
  @keyframes trick-land {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .trick-row.newest {
      animation: none;
    }
  }
  .trick-cards {
    display: flex;
  }
  .trick-cards :global(.card-sm) {
    margin-left: -20px;
  }
  .trick-cards :global(.card-sm:first-child) {
    margin-left: 0;
  }
</style>
