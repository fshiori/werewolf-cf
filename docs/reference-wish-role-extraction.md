# Reference Wish Role Extraction

Date: 2026-05-06

Reference target: `ref/diam1.3.61.kz_Build0912/game_vote.php`

Scope: this records the reference wish-role assignment behavior as input, state, and output. It does not copy PHP code and does not modify `ref/`.

## Reference Flow

Input:

- Room option string containing `wish_role`.
- Each joined user's stored requested role from `user_entry.role`.
- The current role deck after room-size thresholds and enabled optional roles have been applied.

State transition:

- The reference queries eligible users in randomized order before processing wishes.
- For each randomized user, it reads the requested role only when `wish_role` is enabled; otherwise it treats the request as absent.
- If the requested role is found in the remaining role deck, it appends that user and requested role to parallel assignment arrays, then removes that role from the remaining deck.
- If the requested role is absent, that user is kept in a retry array.
- After the first pass, retry users are appended in retry order and paired with the remaining role deck entries.
- After building those parallel arrays, the reference generates randomized role-array keys and uses those keys for later subrole assignment.
- The final database update iterates user-array order and writes the role stored at the same index.

Observed caveat:

- The reference uses a loose comparison around the role search result. In PHP, a match at index `0` compares as false, so the first role in the remaining deck may not be granted through the wish branch. This looks like an implementation quirk rather than an explicit game rule.

## Current Port

Current TypeScript behavior in `src/game.ts` is intentionally simpler:

- The role deck is prepared with enabled optional roles before wish assignment.
- Players are processed in current lobby order, not in a pre-shuffled user query order.
- The first player whose wished role is still available receives that role.
- Duplicate or unavailable wishes fall back to the remaining role deck in order.
- The port uses strict index checks and therefore does not reproduce the PHP index-0 loose-comparison quirk.

Focused automated evidence:

- `tests/game.test.ts` covers core wished roles.
- `tests/game.test.ts` covers enabled optional-role wishes before remaining role assignment.
- `tests/validation.test.ts` covers accepted wished-role values.
- `tests/render.test.ts` covers the room wish-role selector.

## Remaining Parity Decision

Before marking wish-role parity complete, decide whether the Cloudflare port should:

1. Preserve the current deterministic lobby-order behavior for transparency and testability.
2. Add reference-style pre-assignment randomization and conflict ordering.
3. Intentionally emulate or explicitly reject the PHP index-0 loose-comparison quirk.

The safest current status is Partial: the functional surface exists, including optional-role wishes, but exact reference ordering and edge-case behavior are not yet ported.
