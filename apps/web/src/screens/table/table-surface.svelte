<script lang="ts">
  import type { RoomView } from '@samloc/worker/ws-types';
  import ActionBar from '../../components/action-bar.svelte';
  import CardFlight from '../../components/card-flight.svelte';
  import CentreStack from '../../components/centre-stack.svelte';
  import DealFlight from '../../components/deal-flight.svelte';
  import DeckStack from '../../components/deck-stack.svelte';
  import EmojiBar from '../../components/emoji-bar.svelte';
  import HandFan from '../../components/hand-fan.svelte';
  import MeChip from '../../components/me-chip.svelte';
  import OpponentSeat from '../../components/opponent-seat.svelte';
  import TableTopBar from '../../components/table-top-bar.svelte';
  import { room } from '../../lib/room.svelte';
  import {
    CENTRE_POINT,
    FAN_ORIGIN,
    opponentSlots,
    slotOrigin,
    SLOT_POSITIONS,
    TABLE_HEIGHT,
    TABLE_WIDTH,
    type Point,
  } from '../../lib/table-layout';
  import { tableTheme } from '../../lib/table-theme.svelte';
  import { scatterFor } from '../../lib/trick-scatter';
  import type { TableLogic } from './table-logic.svelte';

  interface Props {
    view: RoomView;
    logic: TableLogic;
    scale: number;
    onmenu: () => void;
    onbaosam: () => void;
    onshowresult: (() => void) | null;
  }

  let { view, logic, scale, onmenu, onbaosam, onshowresult }: Props = $props();

  const mySeat = $derived(view.seats.find((s) => s.seat === view.youSeat) ?? null);

  /** Joined while a hand was running: seated, but not dealt in until the next one. */
  const isSpectator = $derived(
    view.status === 'playing' && view.youSeat >= 0 && view.phase !== 'ended' && (mySeat?.cardCount ?? 0) === 0,
  );

  const opponentSeats = $derived(
    opponentSlots(view.youSeat, view.seats.map((s) => s.seat))
      .map((o) => ({ seatView: view.seats.find((s) => s.seat === o.seat), slot: o.slot, pos: SLOT_POSITIONS[o.slot] }))
      .filter((o) => o.seatView !== undefined),
  );

  /** A seat's point on the table: my fan, or an opponent's avatar. Flights start or end here. */
  function originFor(seat: number | undefined): Point {
    if (seat === undefined) return CENTRE_POINT;
    if (seat === view.youSeat) return FAN_ORIGIN;
    const slot = opponentSeats.find((o) => o.seatView?.seat === seat)?.slot;
    return slot ? slotOrigin(slot) : CENTRE_POINT;
  }

  const flightOrigin = $derived(originFor(logic.flight?.seat));
  const dealTarget = $derived(originFor(logic.deal.currentSeat ?? undefined));

  const samLabel = $derived.by(() => {
    if (!logic.inSamWindow || !mySeat?.samChoice) return null;
    return mySeat.samChoice === 'declare' ? 'Đã báo Sâm' : 'Đã huỷ báo';
  });

  const landing = $derived(logic.flight ? scatterFor(logic.flight.seat, logic.flight.cards) : null);
</script>

<div
  class="table-root"
  style="transform: scale({scale}); width: {TABLE_WIDTH}px; height: {TABLE_HEIGHT}px; {tableTheme.vars}"
>
  <TableTopBar {view} connected={room.ws.connected} {onmenu} {onshowresult} />

  {#each opponentSeats as opp (opp.seatView?.seat)}
    {#if opp.seatView}
      <OpponentSeat
        seat={logic.deal.dealing ? { ...opp.seatView, cardCount: logic.deal.dealtFor(opp.seatView.seat) } : opp.seatView}
        pos={opp.pos}
        active={!logic.inSamWindow && view.turnSeat === opp.seatView.seat}
        inSamWindow={logic.inSamWindow}
        remain={logic.remain}
        turnSeconds={view.settings.turnSeconds}
        tags={logic.tagsFor(opp.seatView.seat)}
        reactions={room.reactionsFor(opp.seatView.seat)}
      />
    {/if}
  {/each}

  <CentreStack trick={view.trick} />

  {#if logic.deal.dealing}
    <DeckStack />
    {#key logic.deal.dealt}
      <DealFlight dx={dealTarget.x - CENTRE_POINT.x} dy={dealTarget.y - CENTRE_POINT.y} />
    {/key}
  {/if}

  {#if logic.flight}
    {#key logic.flight.id}
      <CardFlight
        cards={logic.flight.cards}
        dx={flightOrigin.x - CENTRE_POINT.x}
        dy={flightOrigin.y - CENTRE_POINT.y}
        landDx={landing?.dx ?? 0}
        landDy={landing?.dy ?? 0}
        landRot={landing?.rot ?? 0}
      />
    {/key}
  {/if}

  {#if mySeat}
    <MeChip
      name={mySeat.name}
      userId={mySeat.userId}
      avatarVer={mySeat.avatarVer}
      money={mySeat.money}
      isMyTurn={logic.isMyTurn}
      samLabel={samLabel}
      remain={logic.remain}
      turnSeconds={view.settings.turnSeconds}
      invalidReason={logic.invalidReason}
      denWarn={logic.denWarn}
      tags={logic.tagsFor(mySeat.seat)}
      reactions={room.reactionsFor(mySeat.seat)}
    />
  {/if}

  <EmojiBar onpick={(key) => room.sendEmoji(key)} />

  <HandFan
    hand={logic.deal.dealing ? logic.orderedHand.slice(0, logic.deal.dealtFor(view.youSeat)) : logic.orderedHand}
    selected={logic.selected}
    playable={logic.playableIds}
    ontoggle={(id) => logic.toggle(id)}
  />

  {#if isSpectator}
    <p class="spectator-banner">Bạn sẽ vào ván sau</p>
  {:else}
    <ActionBar
      currentCombo={logic.currentCombo}
      canPlay={logic.canPlay}
      isMyTurn={logic.isMyTurn}
      samDecision={logic.showSamDecision ? { remain: logic.samRemain, canDeclare: view.canDeclareSam } : null}
      canSort={view.hand.length > 0}
      onplay={() => logic.play()}
      onpass={() => logic.pass()}
      {onbaosam}
      ondecline={() => logic.decline()}
      onsort={() => logic.toggleSort()}
    />
  {/if}
</div>

<style>
  .table-root {
    position: relative;
    flex-shrink: 0;
    transform-origin: top left;
    background: radial-gradient(ellipse 55% 60% at 50% 45%, var(--felt-light), var(--felt) 60%, var(--felt-dark) 100%);
    border-radius: 12px;
  }
  .spectator-banner {
    position: absolute;
    left: 50%;
    bottom: max(20px, env(safe-area-inset-bottom));
    transform: translateX(-50%);
    margin: 0;
    padding: 8px 18px;
    border-radius: var(--r-full);
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid var(--line);
    font-size: 14px;
    font-weight: 600;
    color: var(--text-muted);
    z-index: 20;
  }
</style>
