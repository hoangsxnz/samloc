<script lang="ts">
  const AUTO_DISMISS_MS = 3000;

  interface Props {
    message: string | null;
    onclear: () => void;
  }

  let { message, onclear }: Props = $props();

  $effect(() => {
    if (!message) return;
    const timer = setTimeout(onclear, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  });
</script>

{#if message}
  <div class="error-toast" role="alert" aria-live="assertive">{message}</div>
{/if}

<style>
  .error-toast {
    position: fixed;
    left: 50%;
    bottom: max(16px, env(safe-area-inset-bottom));
    transform: translateX(-50%);
    z-index: 80;
    max-width: 320px;
    text-align: center;
    background: var(--danger);
    color: #fff;
    font-size: var(--fs-sm);
    font-weight: 600;
    border-radius: var(--r-md);
    padding: var(--sp-2) var(--sp-3);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }
</style>
