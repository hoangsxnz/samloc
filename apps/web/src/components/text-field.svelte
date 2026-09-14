<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  interface Props {
    id: string;
    label: string;
    type?: 'text' | 'password';
    value: string;
    autocomplete?: HTMLInputAttributes['autocomplete'];
    oninput?: () => void;
  }

  let { id, label, type = 'text', value = $bindable(''), autocomplete, oninput }: Props = $props();
</script>

<div class="text-field">
  <label for={id}>{label}</label>
  <input class="input" {id} {type} bind:value {autocomplete} oninput={() => oninput?.()} />
</div>

<style>
  .text-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: var(--sp-2);
  }
  label {
    font-size: var(--fs-sm);
    font-weight: 600;
  }
</style>
