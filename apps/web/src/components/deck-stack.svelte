<script lang="ts">
  import PlayingCard from './playing-card.svelte';
</script>

<!-- Face-down pile in the centre while the deal animation runs; shares the centre stack's box. -->
<div class="deck-stack" aria-hidden="true">
  {#each [0, 1, 2] as i (i)}
    <div class="deck-card" style="transform: translate(-50%, -50%) translate({i * 2}px, {-i * 2}px)">
      <PlayingCard back size="sm" />
    </div>
  {/each}
</div>

<style>
  .deck-stack {
    position: absolute;
    top: 150px;
    left: 50%;
    transform: translateX(-50%);
    width: 240px;
    height: 100px;
    pointer-events: none;
  }
  .deck-card {
    position: absolute;
    left: 50%;
    top: 50%;
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.45));
  }
</style>
