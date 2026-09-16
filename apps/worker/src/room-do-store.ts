import type { RoomSettings } from './ws-types';

export type RoomStatus = 'waiting' | 'playing' | 'hand-end';

export interface RoomRow {
  code: string;
  hand_no: number;
  max_players: number;
  turn_seconds: number;
  stake_per_la: number;
  status: RoomStatus;
  state_json: string | null;
  result_json: string | null;
  /** Current trick log (JSON `TrickLog`); a finished trick stays until the next lead. */
  trick_json: string | null;
  turn_deadline: number | null;
  /** Who leads the next hand; resolved to a seat when the hand begins. */
  next_lead_user_id: string | null;
}

export interface SeatRow {
  seat: number;
  user_id: string;
  display_name: string;
  ready: number;
  connected: number;
  total_la: number;
  /** Money balance when the seat was created; displayed money adds total_la × stake. */
  budget_base: number;
}

type RoomPatch = Partial<Omit<RoomRow, 'code'>>;
type SeatPatch = Partial<Pick<SeatRow, 'ready' | 'connected' | 'display_name'>>;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS room (
  id INTEGER PRIMARY KEY CHECK (id = 1), code TEXT NOT NULL, hand_no INTEGER NOT NULL DEFAULT 0,
  max_players INTEGER NOT NULL, turn_seconds INTEGER NOT NULL, stake_per_la INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting', state_json TEXT, result_json TEXT, trick_json TEXT,
  turn_deadline INTEGER, next_lead_user_id TEXT
);
CREATE TABLE IF NOT EXISTS seats (
  seat INTEGER PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
  ready INTEGER NOT NULL DEFAULT 0, connected INTEGER NOT NULL DEFAULT 0,
  total_la INTEGER NOT NULL DEFAULT 0, budget_base INTEGER NOT NULL DEFAULT 0
);`;

/** Typed wrappers over the Durable Object's SQLite storage; the only place that writes SQL. */
export class RoomStore {
  constructor(private readonly sql: SqlStorage) {}

  ensureSchema(): void {
    this.sql.exec(SCHEMA);
    // CREATE TABLE IF NOT EXISTS leaves a room created before this column shipped untouched, and
    // SQLite has no ADD COLUMN IF NOT EXISTS; a duplicate-column error here is the expected no-op.
    try {
      this.sql.exec('ALTER TABLE seats ADD COLUMN budget_base INTEGER NOT NULL DEFAULT 0');
    } catch {
      // Column already present.
    }
  }

  seedRoom(code: string, settings: RoomSettings): void {
    this.sql.exec(
      `INSERT OR IGNORE INTO room (id, code, max_players, turn_seconds, stake_per_la) VALUES (1, ?, ?, ?, ?)`,
      code,
      settings.maxPlayers,
      settings.turnSeconds,
      settings.stakePerLa,
    );
  }

  getRoom(): RoomRow | null {
    return this.rows<RoomRow>('SELECT * FROM room WHERE id = 1')[0] ?? null;
  }

  /** Runs a query and casts the rows; column types are fixed by the schema above. */
  private rows<T>(query: string, ...bindings: SqlStorageValue[]): T[] {
    return this.sql.exec(query, ...bindings).toArray() as unknown as T[];
  }

  patchRoom(patch: RoomPatch): void {
    const keys = Object.keys(patch) as (keyof RoomPatch)[];
    if (keys.length === 0) return;
    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => patch[k] ?? null);
    this.sql.exec(`UPDATE room SET ${setClause} WHERE id = 1`, ...values);
  }

  listSeats(): SeatRow[] {
    return this.rows<SeatRow>('SELECT * FROM seats ORDER BY seat');
  }

  findSeat(userId: string): SeatRow | null {
    return this.rows<SeatRow>('SELECT * FROM seats WHERE user_id = ?', userId)[0] ?? null;
  }

  /**
   * Appends after the highest seat so a vacated number is never reused mid-session; the next deal
   * re-packs. New seats are ready by default — the waiting screen can still un-ready deliberately.
   */
  addSeat(userId: string, displayName: string, budgetBase: number): SeatRow {
    const seats = this.listSeats();
    const seat = seats.length === 0 ? 0 : (seats[seats.length - 1]?.seat ?? -1) + 1;
    this.sql.exec(
      'INSERT INTO seats (seat, user_id, display_name, ready, connected, budget_base) VALUES (?, ?, ?, 1, 1, ?)',
      seat,
      userId,
      displayName,
      budgetBase,
    );
    return {
      seat,
      user_id: userId,
      display_name: displayName,
      ready: 1,
      connected: 1,
      total_la: 0,
      budget_base: budgetBase,
    };
  }

  setSeat(seat: number, patch: SeatPatch): void {
    const keys = Object.keys(patch) as (keyof SeatPatch)[];
    if (keys.length === 0) return;
    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => patch[k] ?? null);
    this.sql.exec(`UPDATE seats SET ${setClause} WHERE seat = ?`, ...values, seat);
  }

  removeSeat(seat: number): void {
    this.sql.exec('DELETE FROM seats WHERE seat = ?', seat);
  }

  removeDisconnectedSeats(): void {
    this.sql.exec('DELETE FROM seats WHERE connected = 0');
  }

  /** Re-packs seat numbers to 0..n-1 in ascending order so they match the rules engine's seats. */
  compactSeats(): void {
    this.listSeats().forEach((row, index) => {
      if (row.seat !== index) this.sql.exec('UPDATE seats SET seat = ? WHERE seat = ?', index, row.seat);
    });
  }

  resetReady(): void {
    this.sql.exec('UPDATE seats SET ready = 0');
  }

  addTotals(deltas: number[]): void {
    deltas.forEach((delta, seat) => {
      if (delta !== 0) this.sql.exec('UPDATE seats SET total_la = total_la + ? WHERE seat = ?', delta, seat);
    });
  }
}
