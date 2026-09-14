<script lang="ts" generics="T extends string | number">
  interface Props<T> {
    label: string;
    options: T[];
    value: T;
    format?: (option: T) => string;
  }

  let { label, options, value = $bindable(), format }: Props<T> = $props();
</script>

<div class="seg-row">
  <span class="seg-label">{label}</span>
  <div class="seg" role="radiogroup" aria-label={label}>
    {#each options as option (option)}
      <button type="button" class="seg-btn" role="radio" aria-checked={option === value} onclick={() => (value = option)}>
        <span class="seg-pill" class:on={option === value}>{format ? format(option) : option}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .seg-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
  }
  .seg-label {
    font-size: var(--fs-sm);
    font-weight: 600;
  }
  .seg {
    display: flex;
    background: var(--bg);
    border-radius: var(--r-sm);
  }
  .seg-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-width: 40px;
    height: 44px;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .seg-pill {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 34px;
    width: 100%;
    padding: 0 4px;
    border-radius: var(--r-sm);
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--text-muted);
  }
  .seg-pill.on {
    background: var(--gold);
    color: var(--on-gold);
  }
</style>
