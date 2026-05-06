# Betrayer / Cult Asset Extraction

Reference inspected: `ref/diam1.3.61.kz_Build0912`.

## Finding

The reference build does not appear to define a separate playable "cult" role. The `cult` asset filenames are used for the `betr` / `背德` role.

Evidence:

- `setting.php` assigns `$role_betr_image = 'img/role_cult.gif'` and `$role_betr_partner_image = 'img/role_cult_partner.gif'`.
- `index.php` exposes the 20-player fox option value `betr` with label `背德`.
- `game_functions.php` groups `betr` with the fox team in `DetermineRole`.
- `game_vote.php` uses `role LIKE 'betr%'` for linked betrayer death handling.
- `lang/jpn/rule.php` labels the role as `背德` and describes it as the fox-side supporter.

## Port Mapping

The Cloudflare port maps this reference behavior to `PlayerRole` value `betrayer`.

Current artifacts:

- `src/types.ts`: `PlayerRole` includes `betrayer`.
- `src/game.ts`: `applyRoomOptions` can replace a villager with `betrayer`; linked-death handling kills betrayers when foxes die.
- `src/render.ts` and `src/room-client.ts`: `betrayer` is labeled `背德者` and uses `img/role_cult.gif` for the reference role icon.
- `tests/game.test.ts`: covers the room option and linked betrayer deaths.

## Remaining Work

No separate cult-role implementation should be added unless future reference extraction finds a distinct rule path beyond the `betr` / `背德` behavior.
