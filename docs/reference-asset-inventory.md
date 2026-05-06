# Reference Asset Inventory

Date: 2026-05-06

Reference root: `ref/diam1.3.61.kz_Build0912`

Inventory command:

```bash
node scripts/inventory-reference-assets.mjs
```

Priority upload dry-run:

```bash
node scripts/upload-reference-assets.mjs
```

Execute the upload only after confirming the target bucket/config:

```bash
node scripts/upload-reference-assets.mjs --bucket=werewolf-cf-assets --config=wrangler.production.toml --yes
```

The command reads the reference tree and excludes non-asset metadata such as `Thumbs.db`. It does not modify `ref/`.

## Summary

| Category | Count | Bytes | Migration decision |
| --- | ---: | ---: | --- |
| Page chrome | 37 | 616105 | Copy priority assets to R2 under `reference/img/`; use as backgrounds/title images only after rendered pages can fall back gracefully when R2 is empty. |
| Role and result icons | 31 | 74836 | Copy to R2 under `reference/img/role/` and wire into rules/player role reveal UI before adding new role art. |
| Room option icons | 22 | 4145 | Copy to R2 under `reference/img/options/` and replace text-only option marks in room list/create UI. |
| Default user icons | 10 | 17301 | Copy to R2 under `reference/user_icon/` and expose through an icon catalog/picker page before using in joins. |
| Emotes | 7 | 52731 | Defer until talk log supports reference-style emoticon insertion. |
| Gameplay markers | 4 | 6716 | Copy with role/status pass; these are needed for dummy, dead, wolf, and objection-style UI. |
| Room list status | 8 | 3211 | Copy with option icons; these replace text status badges in the room list. |
| Victory images | 7 | 6044 | Copy with old-log/postgame pass; these map directly to winner display. |
| Legacy sounds | 4 | 182412 | Defer. SWF should not be served as-is; replace with modern audio assets or omit explicitly. |

Total browser assets detected: 130 files, 963501 bytes.

## Priority Copy Set

These assets should be copied into R2 first because current rendered pages already have matching UI surfaces:

- `img/top_title.jpg`
- `img/top_bg.jpg`
- `img/waiting.gif`
- `img/playing.gif`
- `img/endroom.gif`
- `img/max8.gif`
- `img/max16.gif`
- `img/max22.gif`
- `img/max23.gif`
- `img/max30.gif`
- `img/room_option_wish_role.gif`
- `img/room_option_real_time.gif`
- `img/room_option_dummy_boy.gif`
- `img/room_option_open_vote.gif`
- `img/room_option_decide.gif`
- `img/room_option_authority.gif`
- `img/room_option_betr.gif`
- `img/room_option_fosi.gif`
- `img/room_option_foxs.gif`
- `img/room_option_poison.gif`
- `img/room_option_wfbig.gif`
- `img/room_option_cat.gif`
- `img/room_option_voteme.gif`
- `img/room_option_trip.gif`
- `img/room_option_will.gif`
- `img/room_option_lovers.gif`
- `img/room_option_gm.gif`
- `img/victory_role_human.gif`
- `img/victory_role_wolf.gif`
- `img/victory_role_fox.gif`
- `img/victory_role_draw.gif`
- `img/victory_role_lovers.gif`

## Icon Catalog Set

These assets cover the reference default icon picker and should be copied as a single batch:

- `user_icon/001.gif`
- `user_icon/002.gif`
- `user_icon/003.gif`
- `user_icon/004.gif`
- `user_icon/005.gif`
- `user_icon/006.gif`
- `user_icon/007.gif`
- `user_icon/008.gif`
- `user_icon/009.gif`
- `user_icon/010.gif`
- `img/dummy_boy_user_icon.gif`
- `img/grave.gif`

Reference metadata from `setting.php`:

- Icon colors: `#DDDDDD`, `#999999`, `#FFD700`, `#FF9900`, `#FF0000`, `#99CCFF`, `#0066FF`, `#00EE00`, `#CC00CC`, `#FF9999`
- Default icon dimensions: 32 x 32
- Reference upload dimensions: max 45 x 55
- Reference upload size: 3092 bytes

The current port already supports user-uploaded avatars in R2 with a larger 512 KiB limit. Do not reduce the upload limit just to match the legacy PHP limit; treat the 3092-byte limit as historical context for the default icon picker.

## Deferred Assets

- `swf/sound_morning.swf`
- `swf/sound_objection_female.swf`
- `swf/sound_objection_male.swf`
- `swf/sound_revote.swf`

The reference uses Flash for notification sounds. A Cloudflare/browser port should replace these with modern audio files only if sound notifications become an explicit feature.

## Next Implementation Step

Use the R2-backed `GET /assets/reference/:path` endpoint to wire the copied priority assets into rendered pages, starting with room-list status images and room option icons.
