# Sâm Lốc Rules Specification

**Status:** Research-based; prioritizes most common variant from Vietnamese sources.

## 1. Setup & Dealing

- **Deck:** 52-card standard deck (4 suits, 13 ranks each).
- **Players:** 2–5 (optimal: 3–4).
- **Hand Size:** 10 cards per player.
- **First Hand:** Holder of 3♠ leads. Sources conflict: some say "lowest card" instead — both treated as equivalent in sorted hands.
- **Subsequent Hands:** Winner of previous hand leads.

## 2. Card Rank Order

**Rank (lowest to highest):** 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A, 2

- **Suits irrelevant:** All suits equal. Rank alone determines value.
- **2 Strength:** 2 (heo) is strongest single card. Only beaten by tứ quý.

## 3. Valid Combinations

1. **Single:** One card.
2. **Pair (đôi):** Two cards, same rank.
3. **Triple (sám cô):** Three cards, same rank.
4. **Four of a Kind (tứ quý):** Four cards, same rank. Beats any single card, any pair, any triple.
5. **Straight (sảnh):** 3+ consecutive ranks. Examples: 3-4-5, 5-6-7-8, Q-K-A, A-2-3 (A low). Min length: 3.

**Straight Constraints (research conflict noted):**
- Commonly cited: Q-K-A valid; A-2-3 valid (A wraps low).
- **Can straight contain 2?** Sources unclear. Most imply 2 cannot chain mid-straight due to its special status; conservative rule: **straights 3–A only, no 2 mid-sequence**. A can be low (A-2-3) or high (Q-K-A) but not both in same straight.
- **3 Đôi Thông (3 consecutive pairs):** Exists in some regional variants but **NOT standard Sâm Lốc**. Cannot beat heo; play as individual pairs.

## 4. Beating Rules

| Combo | Beaten By | Notes |
|-------|-----------|-------|
| Single | Higher single, tứ quý | Rank only |
| Pair | Higher pair, tứ quý | Same rank = stalemate (cannot beat) |
| Triple | Higher triple, tứ quý | - |
| Tứ Quý | Higher tứ quý only | Beats any single/pair/triple; can beat single 2 (chặt heo) |
| Straight | Higher straight (same length) | Must be equal or longer; higher ranks win |

**Key:** Equal ranks (e.g., 5♠ vs 5♣) **cannot beat each other**. Next player must top or pass.

## 5. Turn Flow

1. **Lead:** Player plays combo (any type).
2. **Respond:** Next player clockwise must play same combo type, higher rank, or **pass** (bỏ lượt).
3. **Pass Effect:** Player skips and cannot re-enter until new lead.
4. **Round End:** When all players pass → last player who played leads new combo.
5. **Victory:** First player to play all 10 cards wins round; others tally remaining cards.

## 6. Ăn Trắng (Instant Win at Deal)

**Trigger:** On deal, if hand contains one of these:

| Win Condition | Min Cards | Priority |
|---------------|-----------|----------|
| Sảnh rồng (3–Q or Q-K-A straight, 10 cards) | 10 | 1 |
| Tứ quý 2 (four 2s) | 4 | 2 |
| 10 cards same color (10 reds or 10 blacks) | 10 | 3 |
| 3 sám cô (3 three-of-a-kinds) | 9 | 4 |
| 5 pairs | 10 | 5 |

**Multi-Player:** If multiple players have ăn trắng, highest-priority hand wins. If tied priority, first declared wins.
**Payout:** Each opponent pays winner 20 cards' worth + any quad/2 bonuses (varies by house).

## 7. Báo Sâm (Special Declaration)

**Declaration:** Before playing first card, declare "Sâm" (confidence I'll play all 10 cards without blockage).

**Rules:**
- Any player can declare (before first turn only).
- Declarer leads and must play valid combos in sequence.
- If opponent blocks ANY play → báo sâm fails (đền sâm).
- Success: Declarer receives 20× bet from each opponent.
- Failure: Declarer pays 20× bet to each opponent.
- Cannot declare if hand has ăn trắng (covered by ăn trắng payout instead).

## 8. Cóng (Never Played)

**Condition:** Player never played a single card when round ends.
**Penalty:** 15 cards' worth to winner (configurable: 10–15).

## 9. Thối 2 (Holding 2s at End)

**Condition:** Round ends; player holds ≥1 unplayed 2s.
**Penalty:** 5 points per 2 (sources cite 5–15; default conservative: 5). Some variants: flat 15 total.

## 10. Chặt 2 (Beating a 2 with Tứ Quý)

**Rule:** Tứ quý can beat single 2 at any time (chặt heo).
**Penalty on Chasee:** 10 cards' worth (or per source, penalty transfers if tứ quý beaten by bigger tứ quý).
**Chặt Chồng:** Bigger tứ quý beats smaller tứ quý; chasing penalty may double or transfer.

## 11. Settlement (Scoring)

**Base:** Cards remaining in losers' hands × bet amount.

**Multipliers & Penalties:**
- Cóng: +15 (or flat 15) to winner.
- Thối 2: +5 per 2 to winner.
- Chặt heo: +10 (or variable) to quadholder.
- Báo Sâm (success): ×20 from each.
- Báo Sâm (failure): ×20 to each.
- Ăn trắng: ×20 from each + quads.

**Settlement Recipient:** All penalties paid to **round winner** (who played last) unless otherwise specified.

## 12. Online Defaults (Turntime, Auto-Actions)

- **Turn Timer:** 15–30 seconds (configurable; default 20s).
- **Auto-Pass:** Timeout without action = auto-pass.
- **Auto-Play:** (Optional) Timeout in pass state = auto-play smallest card if valid.

## Decision Defaults & Alternatives

| Rule | Default | Alternative |
|------|---------|-------------|
| First hand lead | 3♠ holder | Lowest card |
| Straight with 2 | NOT allowed mid-sequence | Allow 2 (rare) |
| Cóng penalty | 15 cards | 10 cards |
| Thối 2 penalty | 5 per 2 | 15 total flat |
| Chặt heo penalty | 10 cards | 0 (no special) |
| Báo Sâm payout | 20× bet | 10× or 30× |
| Ăn trắng payout | 20× + quads | Flat 50–100 points |
| 3 Đôi Thông | Not in Sâm | In regional Tiến Lên (not here) |
| Suits in beats | Irrelevant | (Confirmed across all sources) |
| Equal rank beats | No (stalemate) | (Confirmed across all sources) |

## Unresolved Questions for User

1. **Straight with 2:** Can 2-3-4-5 or 3-4-5...K-A-2 exist? Current spec: **NO**. Confirm?
2. **Chặt Heo Penalty Amount:** Fixed 10 or variable (half of bet)? Also, who receives: only chaser or distributed?
3. **Thối 2 Variants:** 5 per 2 vs. flat 15 — which default? Some sources cite double points if hand ends with 2.
4. **Cóng vs Báo Sâm:** If báo sâm fails AND player ends with cóng, do both penalties apply or just báo sâm?
5. **Ăn Trắng Priority Ties:** If two players have same priority ăn trắng (e.g., both have 5 pairs), is it "first to deal" or random?
6. **Pass Mechanics:** After player passes, can they re-enter if someone plays a NEW combo type (not blocked by previous chain)? Current spec: **NO** (locked until new lead).
7. **Báo Sâm + Ăn Trắng:** If player has both ăn trắng and declares báo sâm, which payout applies?
8. **Point Per Card Multiplier:** Is it always 1× bet per card, or does combo type multiply (e.g., triple = 3× per card)? Most sources: **simple 1× per card**.

---

**Sources Consulted:**
- [Sâm Lốc: Luật Chơi, Chiến Thuật](https://usfinancial.us.com/sam-loc/)
- [Hướng dẫn luật chơi Sâm Lốc từ A đến Z](https://azione.us.com/luat-choi-sam-loc/)
- [Sảnh Rồng - Luật chơi chuẩn](https://sanhrong.info/game-sam-loc/luat-choi)
- [Sâm Lốc Nhatvip - Báo Sâm & Tính Điểm](https://micromono.io/sam-loc/)
- [Cách chơi bài Sâm chi tiết - MyTour](https://mytour.vn/vi/blog/bai-viet/bi-quyet-choi-bai-sam-gioi-chien-thang-de-dang.html)

