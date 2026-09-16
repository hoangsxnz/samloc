# Sâm Lốc — Rule Spec (house rules confirmed 2026-09-14)

Unit: **lá**. Room setting: **stake per lá** (50/100/200/500, default 100); displayed score = lá × stake. All penalty amounts below are FIXED (not room-configurable, hidden from UI). Room settings are only: player count, turn timer, stake per lá.

## Setup
- 52 cards, 2–5 players, 10 cards each. Remaining cards unused.
- Rank low→high: 3 4 5 6 7 8 9 10 J Q K A 2. Suits irrelevant; equal rank cannot beat equal rank.
- First hand: holder of the lowest card (3♠ if dealt, else next lowest) leads. Later hands: previous winner leads.

## Combinations
- Single, pair, triple (sám cô), four of a kind (tứ quý), straight (sảnh) of ≥3 consecutive ranks.
- **Straight range: 3 … A, plus the low forms where 2 counts as the lowest rank** — A-2-3, 2-3-4, A-2-3-4-5 … are valid (confirmed 2026-09-14, supersedes the earlier "3 … A only" line). Q-K-A valid. **K-A-2 and Q-K-A-2 stay invalid**: the 2 may sit at the bottom of a straight, never at the top. No suit requirement.
- Low straights rank below every normal straight of the same length: `A-2-3 < 2-3-4 < 3-4-5 < … < Q-K-A`.
- Sảnh rồng (ăn trắng) is unaffected: it still requires a 10-card run inside 3 … A, so a low run is not an instant win.
- No "đôi thông" (consecutive pairs) in this game.

## Beating
- Same type and same length required; higher top rank wins.
- Tứ quý beats any single 2 (chặt heo). Bigger tứ quý beats smaller tứ quý (chặt chồng).
- Tứ quý does NOT beat pairs/triples/straights in play; only singles that are 2s, and other tứ quý.

## Turn flow
- Lead any combo. Next players clockwise must beat or pass. A pass locks that player out until the trick ends.
- Trick ends when all others pass; last player to play leads next.
- **Báo 1**: when a player drops to 1 card, the table is notified (server auto-announces).
- **Đền bài (chặn báo 1)**: if the player immediately before a "báo 1" player leads a single while still holding a strictly higher single, and the báo-1 player then wins on that trick, the leader pays every loser's amount for that hand (confirmed 2026-09-14).
- Turn timer is a room setting (15/20/30 s, default 20). **On timeout every player auto-plays their lowest legal move**, and passes only when nothing they hold beats the trick (confirmed 2026-09-14, supersedes the earlier "if responding → auto-pass" line). A leading seat always has a legal move, so it never passes.
- This holds inside a báo sâm hand too: a non-declarer who times out with a beating combo blocks the sâm, and the declarer pays (confirmed 2026-09-15, chosen for consistency).

## Joining
- A player may join a room that is already playing, up to the room's player count. They spectate the current hand and are dealt in on the next one.
- A seat is ready by default when it is created; the waiting screen can still un-ready deliberately.

## Hand end & scoring
- First to empty hand wins. Each loser pays winner: cards left in hand.
- **Thối 2**: +5 lá per 2 left in hand.
- **Cóng** (played zero cards): pay 15 lá instead of card count (+ thối 2 if any).
- **Chặt 2**: player whose 2 was cut pays cutter 15 lá immediately. Chặt chồng: each cut is a separate transfer — the previous cutter pays the new cutter double the previous amount (15 → 30 → 60 …); earlier transfers stand (confirmed 2026-09-14).
- **Báo Sâm**: declared before any card of the hand is played (any player, multiple allowed — lowest seat number wins). Declarer leads and must win without any play being beaten. Success: every other player pays 20 lá; no card counting. Failure: the hand ends immediately when a declarer's play is beaten; declarer pays each other player 20 lá; nothing else is counted (no card count, no thối 2, no cóng, chặt transfers already made in that hand are voided). The seat that beat the declarer leads the next hand (confirmed 2026-09-14).
- **Ăn trắng** (instant win at deal, checked before Báo Sâm), priority order: sảnh rồng 10 cards (3→Q … 5→A), tứ quý 2, 10 same color, 3 triples, 5 pairs. Each other player pays 20 lá. Ties: earlier seat order wins.

## Open items
- None blocking. Settlement is per hand; session board accumulates.
