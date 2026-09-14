import { toCard, type Combo } from '@samloc/rules';

const SUIT_GLYPHS = ['♠', '♣', '♦', '♥'] as const;
const RANK_LABELS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'] as const;

export function rankLabel(id: string): string {
  return RANK_LABELS[toCard(id).rank - 3] ?? '?';
}

export function suitGlyph(id: string): string {
  return SUIT_GLYPHS[toCard(id).suit] ?? '?';
}

/** ♦ and ♥ are red; ♠ and ♣ are black. */
export function suitColour(id: string): 'red' | 'black' {
  return toCard(id).suit >= 2 ? 'red' : 'black';
}

function rankName(rank: number): string {
  return RANK_LABELS[rank - 3] ?? '?';
}

/** Vietnamese combo label for the action bar, e.g. "Đôi 9", "Sảnh 5-6-7", "Tứ quý K". */
export function comboLabel(combo: Combo | null): string {
  if (!combo) return '';
  switch (combo.type) {
    case 'single':
      return rankName(combo.rank);
    case 'pair':
      return `Đôi ${rankName(combo.rank)}`;
    case 'triple':
      return `Sám cô ${rankName(combo.rank)}`;
    case 'quad':
      return `Tứ quý ${rankName(combo.rank)}`;
    case 'straight': {
      const from = combo.rank - combo.length + 1;
      const ranks: string[] = [];
      for (let r = from; r <= combo.rank; r++) ranks.push(rankName(r));
      return `Sảnh ${ranks.join('-')}`;
    }
  }
}
