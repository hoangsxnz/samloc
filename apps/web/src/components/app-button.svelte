<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    type?: 'button' | 'submit';
    disabled?: boolean;
    onclick?: () => void;
    children: Snippet;
  }

  let { variant = 'primary', type = 'button', disabled = false, onclick, children }: Props = $props();
</script>

<button class="btn btn-{variant}" {type} {disabled} {onclick}>
  {@render children()}
</button>
