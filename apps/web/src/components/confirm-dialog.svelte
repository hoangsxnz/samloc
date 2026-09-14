<script lang="ts">
  import AppButton from './app-button.svelte';

  interface Props {
    title: string;
    body?: string;
    cancelLabel?: string;
    confirmLabel: string;
    danger?: boolean;
    onconfirm: () => void;
    oncancel: () => void;
  }

  let { title, body, cancelLabel = 'Huỷ', confirmLabel, danger = false, onconfirm, oncancel }: Props = $props();
</script>

<div class="confirm-scrim" role="dialog" aria-modal="true" aria-label={title}>
  <div class="panel confirm-box">
    <h3>{title}</h3>
    {#if body}<p>{body}</p>{/if}
    <div class="confirm-actions">
      <AppButton variant="secondary" onclick={oncancel}>{cancelLabel}</AppButton>
      <AppButton variant={danger ? 'danger' : 'primary'} onclick={onconfirm}>{confirmLabel}</AppButton>
    </div>
  </div>
</div>

<style>
  .confirm-scrim {
    position: fixed;
    inset: 0;
    z-index: 70;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--sp-4);
  }
  .confirm-box {
    width: 100%;
    max-width: 320px;
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .confirm-box h3 {
    margin: 0;
    font-size: var(--fs-lg);
  }
  .confirm-box p {
    margin: 0;
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }
  .confirm-actions {
    display: flex;
    gap: var(--sp-2);
  }
</style>
