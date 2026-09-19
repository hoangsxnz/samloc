<script lang="ts">
  import type { RoomView } from '@samloc/worker/ws-types';
  import { formatMoneyDelta } from '../lib/format-money';

  interface Props {
    view: RoomView;
    connected: boolean;
    onmenu: () => void;
    /** Set while the hand result is collapsed: the "Kết quả" chip reopens it. */
    onshowresult: (() => void) | null;
  }

  let { view, connected, onmenu, onshowresult }: Props = $props();

  const mySeat = $derived(view.seats.find((s) => s.seat === view.youSeat) ?? null);
  /** Session swing in money: the same `totalLa × stakePerLa` the server uses for the balance. */
  const swing = $derived((mySeat?.totalLa ?? 0) * view.settings.stakePerLa);
</script>

<header class="table-top">
  <span class="conn-dot" class:offline={!connected}></span>
  <span class="room-code">{view.code}</span>
  <span class="hand-no">· Ván {view.handNo}</span>
  {#if mySeat}
    <span class="chip session-chip" class:neg={swing < 0}>{formatMoneyDelta(swing)}</span>
  {/if}
  {#if onshowresult}
    <button type="button" class="result-chip" onclick={onshowresult}>Kết quả</button>
  {/if}
  <button type="button" class="menu-btn" aria-label="Menu bàn chơi" onclick={onmenu}>≡</button>
</header>

<style>
  .table-top {
    position: absolute;
    top: 0;
    left: max(40px, env(safe-area-inset-left));
    right: max(40px, env(safe-area-inset-right));
    height: 44px;
    padding-top: max(8px, env(safe-area-inset-top));
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--text-muted);
  }
  .conn-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--success);
  }
  .conn-dot.offline {
    background: var(--warn);
  }
  .room-code {
    font-weight: 700;
    letter-spacing: 0.12em;
    color: var(--text);
  }
  .session-chip {
    margin-left: auto;
    color: var(--success);
  }
  .session-chip.neg {
    color: var(--danger);
  }
  .result-chip {
    height: 32px;
    padding: 0 14px;
    border-radius: var(--r-full);
    background: var(--gold);
    color: var(--on-gold);
    font-weight: 700;
    font-size: 13px;
    border: 0;
    cursor: pointer;
  }
  .menu-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text);
    font-size: 20px;
    margin-right: -8px;
    margin-left: 4px;
    background: none;
    border: 0;
    cursor: pointer;
  }
</style>
