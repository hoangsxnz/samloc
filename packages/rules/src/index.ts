export const RULES_VERSION = '1';

export {
  type CardId,
  type Card,
  MIN_RANK,
  MAX_RANK,
  TWO_RANK,
  ACE_RANK,
  RANK_LABELS,
  SUIT_LETTERS,
  toId,
  toCard,
  rankOf,
  isTwo,
  compareCards,
  sortHand,
  buildDeck,
} from './cards';
export { type ComboType, type Combo, parseCombo } from './combos';
export { canBeat, lowestSingle, highestSingle } from './compare';
export { type InstantWinKind, hasInstantWin } from './instant-win';
export { type Deal, mulberry32, shuffle, createDeal, lowestCardSeat } from './deal';
export {
  type Phase,
  type PlayerState,
  type TrickState,
  type Transfer,
  type RulesState,
  type Action,
  type GameEvent,
  type StepResult,
  createHand,
  buildHand,
  applyAction,
} from './state';
export { settle } from './settle';
