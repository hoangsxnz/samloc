# Red Team Review: Assumption Destroyer — Sâm Lốc Online Plan

Reviewer role: Assumption Destroyer + Scope Auditor (rule-coverage grep audit).
Scope: plan.md + phase-01..08, cross-checked against docs/game-rules.md, docs/tech-stack.md,
docs/deployment.md, docs/wireframe/*.html, and both research reports.

## Finding 1: `users.display_name` has no data-entry path — registration flow is unimplementable as specified

- **Severity:** Critical
- **Location:** Phase 4, section "D1 schema" and "Route contracts", `phase-04-worker-auth-and-d1.md:39,84,145-147`
- **Flaw:** The `users` table declares `display_name TEXT NOT NULL` (line 39). The only account-creation
  route, `POST /api/register`, accepts `{ username, password }` only (line 84) and Implementation Step 7
  never derives or collects a display name: `register (validate → SELECT 1 FROM users WHERE username=? →
  409 → insert → session → cookie)` (lines 145-147). No field, default, or derivation rule for
  `display_name` exists anywhere in the phase.
- **Failure scenario:** Either (a) the `INSERT INTO users` in step 7 omits `display_name` and violates the
  `NOT NULL` constraint, so every registration 500s, contradicting Phase 4's own success criterion "The
  curl sequence in step 12 returns 200/200/200" and "registering a duplicate username returns 409, not
  500"; or (b) the implementer silently sets `display_name = username`, which the wireframes explicitly
  contradict: `docs/wireframe/02-lobby.html:55` renders the header as
  `<div class="who">Tuấn <small>Đã đăng nhập</small></div>` — a capitalized, diacritic-bearing Vietnamese
  given name — while `phase-04-worker-auth-and-d1.md:135` restricts usernames to
  `/^[a-z0-9_]{3,20}$/` (lowercase, no diacritics, no spaces). A username-derived display name can never
  render as "Tuấn". `docs/wireframe/01-login.html` (notes item 2, and fields at lines 62-65) shows only
  "Tên đăng nhập" and "Mật khẩu" (+ "Nhập lại mật khẩu" on register) — no display-name field exists on
  screen for a user to ever supply one.
- **Evidence:**
  - `phase-04-worker-auth-and-d1.md:39`: `display_name  TEXT NOT NULL,`
  - `phase-04-worker-auth-and-d1.md:84`: `| POST /api/register | { username, password } | { id, username, displayName } + Set-Cookie |`
  - `docs/wireframe/02-lobby.html:55`: `<div class="who">Tuấn <small>Đã đăng nhập</small></div>`
- **Suggested fix:** Add a required "Tên hiển thị" field to the register form (phase 6, wireframe 01) and
  thread it through `POST /api/register`'s body and Phase 4 step 7's insert, or explicitly decide
  `display_name := username` and update the wireframe example to a lowercase ASCII name so the spec is
  internally consistent. Either way, this must be resolved before phase 4, not discovered at phase 8 smoke
  test — it blocks every downstream phase that shows a name (5, 6, 7).

## Finding 2: `GameEvent.handEnd.winnerSeat` is typed non-nullable but the sâm-failure path must emit `null` — guaranteed `tsc` failure

- **Severity:** Critical
- **Location:** Phase 3, section "Architecture" / "Báo sâm window", `phase-03-rules-engine-game-state-and-settlement.md:56,64,81`
- **Flaw:** `RulesState.winnerSeat` is correctly typed `number | null` (line 56). The `GameEvent` union's
  `handEnd` variant, however, is declared as `{ type: 'handEnd'; winnerSeat: number }` (line 64) — no
  `| null`. The very next paragraph specifies the sâm-failure transition that must emit this event:
  "Any other seat's play beating the declarer → `samResult = 'fail'`, `phase = 'ended'`,
  `winnerSeat = null`, `handEnd`" (line 81).
- **Failure scenario:** Following the Architecture literally, `applyAction` constructs
  `{ type: 'handEnd', winnerSeat: state.winnerSeat }` where `state.winnerSeat` is statically `number | null`.
  Assigning that to a field typed `number` is a compile error under the plan's own mandated
  `"strict": true` / no-`any` tsconfig (`phase-01-monorepo-scaffold-and-tooling.md:29,85`). This directly
  contradicts Phase 3's first Success Criterion, "`pnpm -r typecheck` exits 0" — the phase cannot pass its
  own gate as specified without a type fix nobody has flagged.
- **Evidence:**
  - `phase-03-rules-engine-game-state-and-settlement.md:64`: `| { type: 'trickEnd'; leadSeat: number } | { type: 'handEnd'; winnerSeat: number };`
  - `phase-03-rules-engine-game-state-and-settlement.md:81`: `'fail'`, `phase = 'ended'`, `winnerSeat = null`, `handEnd`. Declarer empties hand → `'success'`,`
- **Suggested fix:** Change the type to `{ type: 'handEnd'; winnerSeat: number | null }` in `state.ts`
  before phase 3 coding starts; add an explicit test case (e.g. "handEnd event carries winnerSeat: null on
  sâm failure") to `reducer-sam.test.ts` so the nullability is pinned, not just typed away.

## Finding 3: Host-reassignment and "empty room closes" are wired only to the explicit `leave` message, not to real-world tab close — a stranded host permanently blocks the room

- **Severity:** High
- **Location:** Phase 5, section "Requirements" and "Connection flow", `phase-05-room-durable-object-realtime.md:27-28,98,146`
- **Flaw:** Requirements state the invariant plainly: "A departing host passes the crown to the next seat;
  an empty room closes" (lines 27-28). But the only place crown-passing is implemented is the explicit
  `leave` WebSocket action: `leave -> drop the seat while waiting (mark disconnected while playing),
  reassign host` (line 98). The passive disconnect path — what fires when someone simply closes a browser
  tab or the device sleeps — is handled elsewhere with no such logic:
  `webSocketClose`/`webSocketError` set `connected = 0` for that seat and re-snapshot" (line 146). Nothing
  reassigns `host_user_id`, and nothing in Phase 5's Related Code Files or Implementation Steps ever closes
  or tears down a room whose seats are all `connected = 0`.
- **Failure scenario:** `docs/wireframe/03-room-waiting.html:70` has a "Rời phòng" button, but the phase 7
  table screen (`docs/wireframe/04-game-table.html`) has no leave/exit control at all — only an
  unspecified "menu" mentioned once in `phase-07-web-game-table-and-results.md:45` and never built out in
  its 13 Implementation Steps. So the only realistic way to leave mid-game is closing the tab, which never
  triggers host reassignment. If the host does this during or after a hand, `start`, `settings`, and
  `nextHand` — all gated on `userId === room.host_user_id` (`phase-05-room-durable-object-realtime.md:190`)
  — become permanently unusable for the remaining 1-4 friends, with no path to recover the room short of
  restarting the whole flow with a new room code. For a private group this is the single most likely way a
  session ends (someone just closes their laptop), yet it is the one path the plan does not handle.
- **Evidence:**
  - `phase-05-room-durable-object-realtime.md:27-28`: "A departing host passes the crown to the next seat; an empty room closes."
  - `phase-05-room-durable-object-realtime.md:98`: `leave    -> drop the seat while waiting (mark disconnected while playing), reassign host`
  - `phase-05-room-durable-object-realtime.md:146`: `on first contact, then upgrades and attaches { userId, name }; webSocketClose/webSocketError`
- **Suggested fix:** Move host-reassignment (and empty-room detection/close) into the shared seat-disconnect
  path used by both the explicit `leave` action and `webSocketClose`/`webSocketError`, not just the former.
  Add a Phase 5 success criterion and test asserting the crown moves when the host's socket closes without
  a `leave` message, and add an explicit leave/exit affordance to the phase 7 table screen instead of
  leaving it inside an unspecified "menu".

## Finding 4: Two rule-spec ambiguities are silently resolved without the group-confirmation flag given to the other two readings

- **Severity:** Medium
- **Location:** Phase 3 vs `docs/game-rules.md:3,25`; Phase 3 vs `docs/game-rules.md:32`
- **Flaw:** Phase 3 explicitly flags exactly two rule readings as unconfirmed and routes them to phase 8
  for group sign-off: đền bài wording and chặt-chồng stacking
  (`phase-03-rules-engine-game-state-and-settlement.md:183-184`, echoed in
  `phase-08-deploy-docs-and-smoke-test.md:148,58`). Two more assumptions of equal ambiguity are baked in
  with no such flag:
  1. **Turn timer.** `docs/game-rules.md:3` lists "turn timer" among the three room-configurable settings,
     but line 25 states "Turn timer 20 s" with no qualifier, reading as a fixed rule. Phase 4/5 resolve
     this by making it configurable at `15 | 20 | 30` seconds
     (`phase-04-worker-auth-and-d1.md:54,136`) — a real value the spec never actually offers (the spec's
     only unambiguous number is 20) — without ever calling out the line-3/line-25 contradiction in game-rules.md
     or asking the group to confirm which reading is correct.
  2. **Báo Sâm tie-break.** `docs/game-rules.md:32` says multiple simultaneous declarations resolve by
     "highest priority: dealer-order first" — but this game has no persistent "dealer" role anywhere else
     in the spec (the leader each hand is whoever holds the lowest card, or the previous winner). Phase 3
     invents a concrete meaning — "multiple declarations resolve to the lowest seat (dealer order first)"
     (`phase-03-rules-engine-game-state-and-settlement.md:78`) — that is a plausible but unstated guess,
     unlike the đền bài/chặt-chồng readings which got an explicit "group confirms in phase 8" tag.
- **Failure scenario:** Both ambiguities can only be caught by a human at the phase 8 smoke test, but
  because they are not listed as open items (unlike the other two), nobody is prompted to specifically ask
  the play-testers about them — the group might play several sessions before someone notices the timer
  isn't fixed at 20s, or that seat-0-priority sâm tie-break wasn't what "dealer-order" meant to them.
- **Evidence:**
  - `docs/game-rules.md:3`: "Room settings are only: player count, turn timer, stake per lá."
  - `docs/game-rules.md:25`: "Turn timer 20 s."
  - `docs/game-rules.md:32`: "highest priority: dealer-order first"
  - `phase-03-rules-engine-game-state-and-settlement.md:78`: "multiple declarations resolve to the lowest seat (dealer order first)"
- **Suggested fix:** Add both to Phase 3's Risk Assessment / Next Steps as explicitly-flagged open
  questions (same treatment as the other two), and add them to the Phase 8 smoke checklist items list so
  they get a pass/fail + group sign-off like items 17 and 20 do.

## Finding 5: "Chặt skipped on a báo sâm hand" is asserted in prose but absent from the reference pseudocode, and the interaction has zero test coverage

- **Severity:** Medium
- **Location:** Phase 3, section "Chặt 2 / chặt chồng, báo 1, đền bài", `phase-03-rules-engine-game-state-and-settlement.md:100-123`; Test Matrix, lines 162-169
- **Flaw:** The prose states plainly: "Chặt transfers are immediate and final ... and are skipped on a báo
  sâm hand" (line 102). The pseudocode block that Implementation Step 2 tells the coder to translate
  verbatim ("`reducer-play.ts`: `applyPlay`, `applyPass`, `applyTimeout` plus private ... `applyChat`,
  `updateDenWatch`", line 153) contains no `samSeat` guard anywhere in the chặt-detection branch
  (lines 106-113): `if (combo.type === 'quad' && trick.combo?.type === 'single' && trick.combo.rank ===
  15) { push {...}; emit chat2(...) }` fires unconditionally on the stated condition, sâm or not.
- **Failure scenario:** `settle.ts`'s early return for `samSeat !== null` (lines 130-131) means a chặt
  transfer recorded during a sâm hand is silently dropped from scoring — but the `chat2` **event** would
  already have been broadcast and rendered as a "Chặt 2 +15" tag under the cutter's seat in Phase 7
  (`phase-07-web-game-table-and-results.md:91`), showing players a payout that never actually posts to the
  settlement. This exact interaction (a quad played against a sâm declarer's single 2) has no named test
  in either the Phase 2 (`compare.test.ts`) or Phase 3 (`reducer-chat-den.test.ts`, `settle.test.ts`) test
  matrices — it is invisible to `pnpm --filter @samloc/rules test` passing green.
- **Evidence:**
  - `phase-03-rules-engine-game-state-and-settlement.md:102`: "are skipped on a báo sâm hand"
  - `phase-03-rules-engine-game-state-and-settlement.md:106-108`: `if (combo.type === 'quad' && trick.combo?.type === 'single' && trick.combo.rank === 15) { push {...}; lastCut = {...}; emit chat2(chong: false) }`
  - `phase-03-rules-engine-game-state-and-settlement.md:130-131`: `if (samSeat !== null) { ... return d }`
- **Suggested fix:** Add the explicit `if (state.samSeat === null)` guard to the chặt/báo1/đền bài block in
  the Architecture pseudocode itself (not just prose), and add a test case such as "no chặt 2 event or
  transfer during a báo sâm hand" to `reducer-chat-den.test.ts`.

---

## Scope Auditor: rule-bullet coverage sweep (docs/game-rules.md → phase 2/3 test matrices)

Every bullet in `docs/game-rules.md` has a named test in Phase 2 or Phase 3, **except** the two items
folded into Finding 4 (turn-timer fixed-vs-configurable, báo sâm dealer-order tie-break) and the
sâm-hand/chặt interaction in Finding 5, none of which have dedicated coverage. All other rule bullets —
setup/deal, combo recognition, straight bounds, no đôi thông, beating order, chặt heo/chặt chồng doubling,
pass-lock/trick-end, báo 1, đền bài (5 positive/negative cases), timeout auto-play/auto-pass, thối 2, cóng,
báo sâm success/failure, ăn trắng priority + seat tie-break — map cleanly to named cases in
`combos.test.ts`, `compare.test.ts`, `instant-win.test.ts`, `deal.test.ts`, `reducer-turn-flow.test.ts`,
`reducer-sam.test.ts`, `reducer-chat-den.test.ts`, and `settle.test.ts`. No test name in either matrix
describes behavior absent from `docs/game-rules.md` — I found no invented-behavior tests.

The `ba-sam-co` tứ-quý-counts-as-a-triple ambiguity (`phase-02-rules-engine-cards-and-combos.md:172`) is
correctly flagged as an open question for the group — this is the pattern Finding 4's two omissions
should have followed.

The CF report's disputed claims (`storage.get/put` unavailable, `sql.exec` return shape) are correctly
hedged: Phase 5's Risk Assessment explicitly notes the plan uses `sql.exec` exclusively regardless of which
claim is true and defers the result-shape question to the first `wrangler dev` run
(`phase-05-room-durable-object-realtime.md:178`) — no action needed there.

**Status:** DONE
**Summary:** 5 findings (2 Critical, 1 High, 2 Medium): an unimplementable registration flow
(`display_name` has no source), a guaranteed TypeScript compile failure in the `GameEvent.handEnd` type,
a host-reassignment gap that only fires on explicit `leave` and not on a closed tab (the realistic case),
and two rule-spec ambiguities resolved silently instead of flagged like their siblings, plus one
prose/pseudocode mismatch around chặt-during-sâm with zero test coverage. Scope-auditor sweep found full
rule-bullet test coverage otherwise, and no invented-behavior tests.
**Concerns/Blockers:** Findings 1 and 2 should block phase 4 and phase 3 respectively from being marked
complete until fixed — both are concrete, not speculative (SQL NOT NULL violation; TS compile error).
Findings 3-5 are strongly recommended fixes but not build-blocking in the same way.
