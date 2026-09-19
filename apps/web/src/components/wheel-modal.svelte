<script lang="ts">
  import { api, ApiError, type SpinResult, type WheelSegmentView } from '../lib/api';
  import { formatMoney } from '../lib/format-money';
  import { labelPosition, rotationFor, segmentPath } from '../lib/wheel';
  import AppButton from './app-button.svelte';

  interface Props {
    segments: WheelSegmentView[];
    spinsLeft: number;
    onspun: (result: SpinResult) => void;
    onclose: () => void;
  }

  let { segments, spinsLeft, onspun, onclose }: Props = $props();

  const RADIUS = 140;
  const SPIN_MS = 4000;
  /* `transitionend` is skipped in a hidden tab; the fallback still reveals the result. */
  const FALLBACK_MS = 4300;

  let rotation = $state(0);
  let spinning = $state(false);
  // The modal mounts fresh on every open and owns the count from there on.
  // svelte-ignore state_referenced_locally
  let left = $state(spinsLeft);
  let message = $state('');
  let pending: SpinResult | null = null;
  let fallback: ReturnType<typeof setTimeout> | null = null;

  const reduced = $derived(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const wedges = $derived(segments.map((s, i) => ({ ...s, d: segmentPath(i, segments.length, RADIUS), at: labelPosition(i, segments.length, RADIUS) })));

  function finish(): void {
    if (fallback) clearTimeout(fallback);
    fallback = null;
    const result = pending;
    pending = null;
    spinning = false;
    if (!result) return;
    left = result.spinsLeft;
    message = result.amount > 0 ? `+${formatMoney(result.amount)} 🎉` : 'Chúc may mắn lần sau';
    onspun(result);
  }

  /** The server draws the prize first; the wheel only animates to the returned wedge. */
  async function spin(): Promise<void> {
    if (spinning || left === 0) return;
    spinning = true;
    message = '';
    try {
      pending = await api.spin();
    } catch (err) {
      spinning = false;
      if (err instanceof ApiError && err.status === 429) left = 0;
      message = err instanceof ApiError ? err.message : 'Không thể kết nối máy chủ';
      return;
    }
    if (reduced) {
      finish();
      return;
    }
    rotation = rotationFor(pending.segment, segments.length, rotation);
    fallback = setTimeout(finish, FALLBACK_MS);
  }
</script>

<div class="wheel-overlay">
  <button type="button" class="scrim-backdrop" aria-label="Đóng" disabled={spinning} onclick={onclose}></button>
  <div class="panel wheel-panel" role="dialog" aria-modal="true" aria-label="Vòng quay may mắn">
    <svg class="wheel" viewBox="-160 -160 320 320" aria-hidden="true">
      <g
        class="wheel-disc"
        style="transform: rotate({rotation}deg); transition: transform {reduced ? 0 : SPIN_MS}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)"
        ontransitionend={() => spinning && finish()}
      >
        {#each wedges as w, i (i)}
          <path d={w.d} class="wedge" class:alt={i % 2 === 1} />
          <text
            x={w.at.x}
            y={w.at.y}
            class="wedge-label"
            class:long={w.label.length > 6}
            transform="rotate({w.at.angle - 90} {w.at.x} {w.at.y})"
          >
            {w.label}
          </text>
        {/each}
        <circle r="14" class="hub" />
      </g>
      <polygon points="-11,-158 11,-158 0,-134" class="pointer" />
    </svg>

    <div class="wheel-copy">
      <h2 class="wheel-title">Vòng quay may mắn</h2>
      <p class="wheel-left">Còn {left} lượt hôm nay</p>
      <AppButton disabled={spinning || left === 0} onclick={spin}>Quay</AppButton>
      <p class="wheel-result" aria-live="polite">{message}</p>
      <AppButton variant="ghost" disabled={spinning} onclick={onclose}>Đóng</AppButton>
    </div>
  </div>
</div>

<style>
  .wheel-overlay {
    position: fixed;
    inset: 0;
    z-index: 60;
  }
  .scrim-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    border: 0;
    padding: 0;
    cursor: default;
  }
  /* One explicit size for both the SVG and its column: an auto column sized from a percentage-height
     SVG collapses to ~0 on phone Safari and the wheel paints over the copy. */
  .wheel-panel {
    --wheel: min(300px, calc(100dvh - 72px));
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(560px, calc(100vw - 32px));
    height: auto;
    max-height: calc(100dvh - 24px);
    display: grid;
    grid-template-columns: var(--wheel) minmax(0, 1fr);
    gap: var(--sp-4);
    align-items: center;
  }
  .wheel {
    width: var(--wheel);
    height: var(--wheel);
  }
  .wedge {
    fill: var(--surface-2);
    stroke: var(--gold);
    stroke-width: 1.5;
  }
  .wedge.alt {
    fill: var(--felt-light);
  }
  .wedge-label {
    fill: var(--text);
    font-size: 13px;
    font-weight: 700;
    text-anchor: middle;
    dominant-baseline: middle;
  }
  .wedge-label.long {
    font-size: 10px;
  }
  .hub {
    fill: var(--gold);
    stroke: var(--on-gold);
    stroke-width: 2;
  }
  .pointer {
    fill: var(--gold);
    stroke: var(--on-gold);
    stroke-width: 1.5;
  }
  .wheel-copy {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    min-width: 0;
  }
  .wheel-title {
    margin: 0;
    font-size: var(--fs-lg);
    font-weight: 700;
  }
  .wheel-left {
    margin: 0;
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }
  .wheel-result {
    margin: 0;
    min-height: 24px;
    font-size: var(--fs-md);
    font-weight: 700;
    color: var(--gold);
  }
</style>
