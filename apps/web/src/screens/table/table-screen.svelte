<script lang="ts">
  import { onMount } from 'svelte';
  import ActionBar from '../../components/action-bar.svelte';
  import CardFlight from '../../components/card-flight.svelte';
  import CentreStack from '../../components/centre-stack.svelte';
  import ConfirmDialog from '../../components/confirm-dialog.svelte';
  import EmojiBar from '../../components/emoji-bar.svelte';
  import ErrorToast from '../../components/error-toast.svelte';
  import HandFan from '../../components/hand-fan.svelte';
  import MeChip from '../../components/me-chip.svelte';
  import OpponentSeat from '../../components/opponent-seat.svelte';
  import TableMenuSheet from '../../components/table-menu-sheet.svelte';
  import TableTopBar from '../../components/table-top-bar.svelte';
  import { room } from '../../lib/room.svelte';
  import { go, route } from '../../lib/router.svelte';
  import {
    CENTRE_POINT,
    FAN_ORIGIN,
    opponentSlots,
    slotOrigin,
    SLOT_POSITIONS,
    tableScale,
    TABLE_HEIGHT,
    TABLE_WIDTH,
  } from '../../lib/table-layout';
  import HandResultModal from './hand-result-modal.svelte';
  import { TableLogic } from './table-logic.svelte';

  const code = $derived(route.params.code ?? '');
  const logic = new TableLogic();

  // position:fixed overlays must live outside .table-root: its CSS transform makes it their
  // containing block, which would scale and clip them instead of covering the real viewport.
  let menuOpen = $state(false);
  let confirmingSam = $state(false);

  function declareSam(): void {
    room.declareSam();
    confirmingSam = false;
  }

  // Keyed on the code so navigating between two rooms without leaving the route still reconnects.
  $effect(() => {
    room.connect(code);
  });

  $effect(() => {
    if (room.view?.status === 'waiting') go(`#/room/${code}`);
  });

  let scale = $state(1);
  function updateScale(): void {
    scale = tableScale(window.innerHeight, window.innerWidth);
  }
  onMount(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  });

  const view = $derived(room.view);
  const mySeat = $derived(view ? (view.seats.find((s) => s.seat === view.youSeat) ?? null) : null);

  const opponentSeats = $derived.by(() => {
    if (!view) return [];
    return opponentSlots(view.youSeat, view.seats.map((s) => s.seat))
      .map((o) => ({ seatView: view.seats.find((s) => s.seat === o.seat), slot: o.slot, pos: SLOT_POSITIONS[o.slot] }))
      .filter((o) => o.seatView !== undefined);
  });

  /** Where a played combo starts its flight: my fan, or the playing opponent's avatar. */
  const flightOrigin = $derived.by(() => {
    const seat = logic.flight?.seat;
    if (seat === undefined || !view) return CENTRE_POINT;
    if (seat === view.youSeat) return FAN_ORIGIN;
    const slot = opponentSeats.find((o) => o.seatView?.seat === seat)?.slot;
    return slot ? slotOrigin(slot) : CENTRE_POINT;
  });
</script>

{#if view}
  <div class="table-wrapper">
    <div class="table-root" style="transform: scale({scale}); width: {TABLE_WIDTH}px; height: {TABLE_HEIGHT}px;">
      <TableTopBar {view} connected={room.ws.connected} onmenu={() => (menuOpen = true)} />

      {#each opponentSeats as opp (opp.seatView?.seat)}
        {#if opp.seatView}
          <OpponentSeat
            seat={opp.seatView}
            pos={opp.pos}
            active={view.turnSeat === opp.seatView.seat}
            remain={logic.remain}
            turnSeconds={view.settings.turnSeconds}
            tags={logic.tagsFor(opp.seatView.seat)}
            reactions={room.reactionsFor(opp.seatView.seat)}
          />
        {/if}
      {/each}

      <CentreStack trick={view.trick} seats={view.seats} />

      {#if logic.flight}
        {#key logic.flight.id}
          <CardFlight
            cards={logic.flight.cards}
            dx={flightOrigin.x - CENTRE_POINT.x}
            dy={flightOrigin.y - CENTRE_POINT.y}
          />
        {/key}
      {/if}

      {#if mySeat}
        <MeChip
          name={mySeat.name}
          isMyTurn={logic.isMyTurn}
          remain={logic.remain}
          turnSeconds={view.settings.turnSeconds}
          invalidReason={logic.invalidReason}
          denWarn={logic.denWarn}
          tags={logic.tagsFor(mySeat.seat)}
          reactions={room.reactionsFor(mySeat.seat)}
        />
      {/if}

      <EmojiBar onpick={(key) => room.sendEmoji(key)} />

      <HandFan hand={view.hand} selected={logic.selected} ontoggle={(id) => logic.toggle(id)} />

      <ActionBar
        currentCombo={logic.currentCombo}
        canPlay={logic.canPlay}
        isMyTurn={logic.isMyTurn}
        canDeclareSam={view.canDeclareSam}
        onplay={() => logic.play()}
        onpass={() => logic.pass()}
        onbaosam={() => (confirmingSam = true)}
      />
    </div>
  </div>

  {#if view.status === 'hand-end' && view.result}
    <HandResultModal result={view.result} seats={view.seats} youAreHost={view.youAreHost} />
  {/if}

  {#if menuOpen}
    <TableMenuSheet status={view.status} onclose={() => (menuOpen = false)} />
  {/if}

  {#if confirmingSam}
    <ConfirmDialog
      title="Báo Sâm?"
      body="Thua đền 20 lá/người"
      confirmLabel="Báo Sâm"
      onconfirm={declareSam}
      oncancel={() => (confirmingSam = false)}
    />
  {/if}
{:else}
  <div class="screen centered-screen connecting">
    <p>{room.ws.failed ? 'Không thể kết nối tới bàn chơi' : 'Đang kết nối bàn chơi…'}</p>
    <button type="button" class="btn btn-secondary" onclick={() => room.leave()}>Về sảnh</button>
  </div>
{/if}

<div class="visually-hidden" aria-live="polite">{logic.ariaLive}</div>

<ErrorToast message={room.lastError} onclear={() => room.clearError()} />

<style>
  .connecting {
    flex-direction: column;
    gap: var(--sp-4);
    color: var(--text-muted);
  }
  .connecting .btn {
    width: 200px;
  }
  .table-wrapper {
    height: 100dvh;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .table-root {
    position: relative;
    flex-shrink: 0;
    transform-origin: top left;
    background: radial-gradient(ellipse 55% 60% at 50% 45%, var(--felt-light), var(--felt) 60%, var(--felt-dark) 100%);
    border-radius: 12px;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
