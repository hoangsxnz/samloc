# Sâm Lốc — Rule Spec (house rules confirmed 2026-09-14)

Unit: **lá**. Room setting: **stake per lá** (50/100/200/500, default 100); displayed score = lá × stake. All penalty amounts below are FIXED (not room-configurable, hidden from UI). Room settings are only: player count, turn timer, stake per lá.

## Setup
- 52 cards, 2–5 players, 10 cards each. Remaining cards unused.
- Rank low→high: 3 4 5 6 7 8 9 10 J Q K A 2. Suits irrelevant; equal rank cannot beat equal rank.
- First hand: holder of the lowest card (3♠ if dealt, else next lowest) leads. Later hands: previous winner leads.

## Combinations
- Single, pair, triple (sám cô), four of a kind (tứ quý), straight (sảnh) of ≥3 consecutive ranks.
- **Straight range: 3 … A only.** Q-K-A valid; K-A-2 and A-2-3 invalid. No suit requirement.
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
- Turn timer is a room setting (15/20/30 s, default 20). On timeout: if leading → auto-play lowest single; if responding → auto-pass.

## Hand end & scoring
- First to empty hand wins. Each loser pays winner: cards left in hand.
- **Thối 2**: +5 lá per 2 left in hand.
- **Cóng** (played zero cards): pay 15 lá instead of card count (+ thối 2 if any).
- **Chặt 2**: player whose 2 was cut pays cutter 15 lá immediately. Chặt chồng: each cut is a separate transfer — the previous cutter pays the new cutter double the previous amount (15 → 30 → 60 …); earlier transfers stand (confirmed 2026-09-14).
- **Báo Sâm**: declared before any card of the hand is played (any player, multiple allowed — lowest seat number wins). Declarer leads and must win without any play being beaten. Success: every other player pays 20 lá; no card counting. Failure: the hand ends immediately when a declarer's play is beaten; declarer pays each other player 20 lá; nothing else is counted (no card count, no thối 2, no cóng, chặt transfers already made in that hand are voided). The seat that beat the declarer leads the next hand (confirmed 2026-09-14).
- **Ăn trắng** (instant win at deal, checked before Báo Sâm), priority order: sảnh rồng 10 cards (3→Q … 5→A), tứ quý 2, 10 same color, 3 triples, 5 pairs. Each other player pays 20 lá. Ties: earlier seat order wins.

## Open items
- None blocking. Settlement is per hand; session board accumulates.
