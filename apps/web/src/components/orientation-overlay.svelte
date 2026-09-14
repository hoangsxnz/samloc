<script lang="ts">
  import { orientation } from '../lib/orientation.svelte';
</script>

{#if orientation.isPortrait}
  <div class="rotate-overlay" role="alert">
    <span class="rotate-icon" aria-hidden="true">⟳</span>
    <p>Xoay ngang máy để chơi</p>
  </div>
{/if}

<style>
  .rotate-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: var(--bg);
    color: var(--text);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--sp-3);
    font-size: var(--fs-lg);
    font-weight: 600;
    text-align: center;
    padding: var(--sp-5);
  }
  .rotate-icon {
    font-size: 48px;
    color: var(--gold);
  }
</style>
