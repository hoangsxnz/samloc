<script lang="ts">
  const LENGTH = 6;

  interface Props {
    value: string;
    onsubmit?: () => void;
  }

  let { value = $bindable(''), onsubmit }: Props = $props();

  let inputs = $state<(HTMLInputElement | null)[]>([]);
  const chars = $derived(Array.from({ length: LENGTH }, (_, i) => value[i] ?? ''));

  function setChar(index: number, char: string): void {
    const next = value.padEnd(LENGTH, ' ').split('');
    next[index] = char;
    value = next.join('').replace(/ +$/, '').slice(0, LENGTH);
  }

  function onInput(index: number, event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    const raw = target.value.replace(/[^0-9]/g, '');
    if (raw.length > 1) {
      value = raw.slice(0, LENGTH);
      inputs[Math.min(raw.length, LENGTH) - 1]?.focus();
      return;
    }
    setChar(index, raw);
    target.value = raw;
    if (raw && index < LENGTH - 1) inputs[index + 1]?.focus();
  }

  function onKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !chars[index] && index > 0) inputs[index - 1]?.focus();
    if (event.key === 'Enter') onsubmit?.();
  }

  function onPaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text') ?? '';
    const raw = text.replace(/[^0-9]/g, '').slice(0, LENGTH);
    if (!raw) return;
    event.preventDefault();
    value = raw;
    inputs[Math.min(raw.length, LENGTH) - 1]?.focus();
  }
</script>

<div class="code-grid" onpaste={onPaste}>
  {#each chars as char, index (index)}
    <input
      bind:this={inputs[index]}
      class="code-box"
      class:cur={index === value.length}
      inputmode="numeric"
      pattern="[0-9]*"
      maxlength="1"
      value={char}
      oninput={(e) => onInput(index, e)}
      onkeydown={(e) => onKeydown(index, e)}
      aria-label={`Chữ số ${index + 1} của mã phòng`}
    />
  {/each}
</div>

<style>
  .code-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .code-box {
    width: 100%;
    min-width: 0;
    height: 48px;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--r-sm);
    color: var(--text);
    font-size: 22px;
    font-weight: 700;
    text-align: center;
    font-family: inherit;
  }
  .code-box:focus {
    outline: none;
    border-color: var(--gold);
    box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.3);
  }
</style>
