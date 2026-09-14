/**
 * Card encoding shared by server and client.
 * rank: 3..15 where 11=J 12=Q 13=K 14=A 15=2.
 * suit: 0=S(♠) 1=C(♣) 2=D(♦) 3=H(♥) — used only for lowest-card tie-breaks and stable sorting.
 * CardId: rank label + suit letter, e.g. "3S", "10H", "JD", "AC", "2S".
 */
export type CardId = string;

export interface Card {
  id: CardId;
  rank: number;
  suit: number;
}

export const MIN_RANK = 3;
export const MAX_RANK = 15;
export const TWO_RANK = 15;
export const ACE_RANK = 14;

/** Indexed from rank 3: RANK_LABELS[rank - 3]. */
export const RANK_LABELS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'] as const;
export const SUIT_LETTERS = ['S', 'C', 'D', 'H'] as const;

export function toId(card: { rank: number; suit: number }): CardId {
  const label = RANK_LABELS[card.rank - MIN_RANK];
  const suit = SUIT_LETTERS[card.suit];
  if (label === undefined || suit === undefined) {
    throw new Error(`Lá bài không hợp lệ: rank ${card.rank} suit ${card.suit}`);
  }
  return `${label}${suit}`;
}

export function toCard(id: CardId): Card {
  const suitLetter = id.slice(-1);
  const label = id.slice(0, -1);
  const suit = SUIT_LETTERS.indexOf(suitLetter as (typeof SUIT_LETTERS)[number]);
  const rankIndex = RANK_LABELS.indexOf(label as (typeof RANK_LABELS)[number]);
  if (suit < 0 || rankIndex < 0) throw new Error(`Lá bài không hợp lệ: ${id}`);
  return { id, rank: rankIndex + MIN_RANK, suit };
}

export function rankOf(id: CardId): number {
  return toCard(id).rank;
}

export function isTwo(id: CardId): boolean {
  return rankOf(id) === TWO_RANK;
}

/** Ascending by rank, then by suit. */
export function compareCards(a: CardId, b: CardId): number {
  const ca = toCard(a);
  const cb = toCard(b);
  return ca.rank - cb.rank || ca.suit - cb.suit;
}

/** Returns a new sorted array; never mutates the input. */
export function sortHand(ids: readonly CardId[]): CardId[] {
  return [...ids].sort(compareCards);
}

/** 52 ids in (rank, suit) order: 3S 3C 3D 3H 4S … 2H. */
export function buildDeck(): CardId[] {
  const deck: CardId[] = [];
  for (let rank = MIN_RANK; rank <= MAX_RANK; rank++) {
    for (let suit = 0; suit < SUIT_LETTERS.length; suit++) {
      deck.push(toId({ rank, suit }));
    }
  }
  return deck;
}
