import type { GameEvent, SamChoice } from '@samloc/rules';
import type { EmojiKey } from './emoji';

export type { GameEvent, SamChoice };
export type { EmojiKey };

export interface RoomSettings {
  maxPlayers: number;
  turnSeconds: number;
  stakePerLa: number;
}

/** Client → server. `seq` is echoed back as `ack` for request matching only. */
export type ClientMsg = { seq: number } & (
  | { type: 'join' | 'start' | 'declareSam' | 'declineSam' | 'pass' | 'nextHand' | 'leave' }
  | { type: 'ready'; value: boolean }
  | { type: 'settings'; settings: RoomSettings }
  | { type: 'play'; cards: string[] }
  | { type: 'emoji'; key: EmojiKey }
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
  /** This seat's sâm decision while the window is open; null until it presses. */
  samChoice: SamChoice | null;
  /** Session total in lá; the top bar shows it as money. */
  totalLa: number;
  /** Money balance in đồng: the seat's starting budget plus `totalLa` × `stakePerLa`. */
  money: number;
  /** Null without an avatar; a bump forces the client to refetch `/api/avatars/:userId`. */
  avatarVer: number | null;
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
  /** This hand's swing in đồng: `deltaLa` × `stakePerLa`. */
  deltaMoney: number;
  /** Money balance in đồng after this hand. */
  moneyAfter: number;
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
  /** True when nothing on the table can be beaten: the next play leads a fresh trick. */
  trickClosed: boolean;
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
  /** Ephemeral reaction: broadcast only, never part of `RoomView` and never persisted. */
  | { type: 'emoji'; seat: number; key: EmojiKey }
  | { type: 'error'; ack: number; msg: string };
