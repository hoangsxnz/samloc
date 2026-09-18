<script lang="ts">
  import PlayingCard from './playing-card.svelte';

  interface Props {
    cards: string[];
    /** Offset of the origin point from the centre stack, in design-frame px. */
    dx: number;
    dy: number;
    /** Where the combo rests on the stack, relative to the centre; matches `scatterFor`. */
    landDx?: number;
    landDy?: number;
    landRot?: number;
  }

  let { cards, dx, dy, landDx = 0, landDy = 0, landRot = 0 }: Props = $props();
</script>

<div
  class="card-flight"
  style="--dx:{dx}px; --dy:{dy}px; --ldx:{landDx}px; --ldy:{landDy}px; --lrot:{landRot}deg"
  aria-hidden="true"
>
  <div class="flight-cards">
    {#each cards as id (id)}
      <PlayingCard {id} size="sm" />
    {/each}
  </div>
</div>

<style>
  .card-flight {
    position: absolute;
    left: 50%;
    top: 200px;
    display: flex;
    justify-content: center;
    pointer-events: none;
    animation: card-fly 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  .flight-cards {
    display: flex;
  }
  .flight-cards :global(.card-sm) {
    margin-left: -20px;
  }
  .flight-cards :global(.card-sm:first-child) {
    margin-left: 0;
  }
  @keyframes card-fly {
    from {
      transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) rotate(0deg) scale(0.85);
      opacity: 0.9;
    }
    to {
      transform: translate(-50%, -50%) translate(var(--ldx), var(--ldy)) rotate(var(--lrot)) scale(1);
      opacity: 1;
    }
  }
</style>
