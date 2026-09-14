<script lang="ts">
  interface Props {
    remain: number;
    turnSeconds: number;
    /** Outer diameter in px. */
    size?: number;
    /** Arc stroke width in px. */
    stroke?: number;
    /** False renders the arc only (used around opponent avatars). */
    digits?: boolean;
  }

  let { remain, turnSeconds, size = 56, stroke = 4, digits = true }: Props = $props();

  const centre = $derived(size / 2);
  const radius = $derived((size - stroke) / 2);
  const circumference = $derived(2 * Math.PI * radius);
  const fraction = $derived(turnSeconds > 0 ? Math.max(0, Math.min(1, remain / turnSeconds)) : 0);
  const dash = $derived(circumference * fraction);
  const danger = $derived(remain < 5);
</script>

<div class="timer-ring" role="timer" aria-label="Thời gian còn lại" style="width:{size}px;height:{size}px">
  <svg viewBox="0 0 {size} {size}" width={size} height={size}>
    <circle cx={centre} cy={centre} r={radius} fill="none" stroke="rgba(255,255,255,.15)" stroke-width={stroke} />
    <circle
      cx={centre}
      cy={centre}
      r={radius}
      fill="none"
      stroke={danger ? 'var(--danger)' : 'var(--gold)'}
      stroke-width={stroke}
      stroke-linecap="round"
      stroke-dasharray={circumference}
      stroke-dashoffset={circumference - dash}
      transform="rotate(-90 {centre} {centre})"
    />
  </svg>
  {#if digits}
    <b class:pulse={danger}>{Math.ceil(remain)}</b>
  {/if}
</div>

<style>
  .timer-ring {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .timer-ring svg {
    position: absolute;
    inset: 0;
  }
  .timer-ring b {
    position: relative;
    font-size: 22px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .pulse {
    animation: timer-digit-pulse 500ms ease-in-out infinite;
  }
  @keyframes timer-digit-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.15); }
  }
</style>
