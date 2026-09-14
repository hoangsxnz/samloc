import type { GameEvent } from '@samloc/rules';

export type { GameEvent };

export interface RoomSettings {
  maxPlayers: number;
  turnSeconds: number;
  stakePerLa: number;
}

/** Client → server. `seq` is echoed back as `ack` for request matching only. */
export type ClientMsg = { seq: number } & (
  | { type: 'join' | 'start' | 'declareSam' | 'pass' | 'nextHand' | 'leave' }
  | { type: 'ready'; value: boolean }
  | { type: 'settings'; settings: RoomSettings }
  | { type: 'play'; cards: string[] }
);

/** isHost = lowest-numbered seat with connected === true; the host is never persisted. */
export interface SeatView {
  seat: number;
  userId: string;
  name: string;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
  cardCount: number;
  passed: boolean;
  bao1: boolean;
  totalLa: number;
}

export interface TrickEntry {
  seat: number;
  cards: string[];
}

/** `cards` = remaining cards, revealed at hand end only. */
export interface ResultRow {
  seat: number;
  name: string;
  cards: string[];
  cong: boolean;
  deltaLa: number;
  totalLa: number;
}

export type HandResultKind = 'normal' | 'an-trang' | 'sam-success' | 'sam-fail' | 'den-bai';

/** `headline` is Vietnamese, e.g. "Tuấn Báo Sâm thành công". */
export interface HandResult {
  handNo: number;
  winnerSeat: number | null;
  nextLeadSeat: number;
  rows: ResultRow[];
  headline: string;
  kind: HandResultKind;
}

export type RoomStatus = 'waiting' | 'playing' | 'hand-end';

/** Per-socket snapshot: `hand` holds only the receiving player's cards; `trick` is newest last. */
export interface RoomView {
  code: string;
  status: RoomStatus;
  settings: RoomSettings;
  handNo: number;
  youSeat: number;
  youAreHost: boolean;
  seats: SeatView[];
  hand: string[];
  trick: TrickEntry[];
  phase: 'sam-window' | 'playing' | 'ended' | null;
  turnSeat: number | null;
  samSeat: number | null;
  turnDeadline: number | null;
  canDeclareSam: boolean;
  result: HandResult | null;
}

export type ServerMsg =
  | { type: 'snapshot'; ack: number; view: RoomView }
  | { type: 'event'; event: GameEvent }
  | { type: 'error'; ack: number; msg: string };
