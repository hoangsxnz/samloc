<script lang="ts">
  import PlayingCard from './playing-card.svelte';

  interface Props {
    /** Offset of the receiving seat from the centre deck, in design-frame px. */
    dx: number;
    dy: number;
  }

  let { dx, dy }: Props = $props();
</script>

<!-- One face-down card leaving the deck; the real fan or count grows as this copy fades. -->
<div class="deal-flight" style="--dx:{dx}px; --dy:{dy}px" aria-hidden="true">
  <PlayingCard back size="sm" />
</div>

<style>
  .deal-flight {
    position: absolute;
    left: 50%;
    top: 200px;
    pointer-events: none;
    animation: deal-fly 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  @keyframes deal-fly {
    from {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
    to {
      transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(0.6);
      opacity: 0.2;
    }
  }
</style>
