#!/usr/bin/env node

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEFAULT_REF_ROOT = "ref/diam1.3.61.kz_Build0912";
const DEFAULT_BUCKET = "werewolf-cf-assets";
const DEFAULT_PREFIX = "reference";

const PRIORITY_ASSETS = [
  "img/top_title.jpg",
  "img/top_bg.jpg",
  "img/icon_view_title.jpg",
  "img/icon_view_bg.jpg",
  "img/icon_upload_title.jpg",
  "img/icon_upload_bg.jpg",
  "img/waiting.gif",
  "img/playing.gif",
  "img/endroom.gif",
  "img/conn_look.gif",
  "img/max8.gif",
  "img/max16.gif",
  "img/max22.gif",
  "img/max23.gif",
  "img/max30.gif",
  "img/room_option_wish_role.gif",
  "img/room_option_real_time.gif",
  "img/room_option_dummy_boy.gif",
  "img/room_option_open_vote.gif",
  "img/room_option_decide.gif",
  "img/room_option_authority.gif",
  "img/room_option_betr.gif",
  "img/room_option_fosi.gif",
  "img/room_option_foxs.gif",
  "img/room_option_poison.gif",
  "img/room_option_wfbig.gif",
  "img/room_option_cat.gif",
  "img/room_option_common.gif",
  "img/room_option_voteme.gif",
  "img/room_option_rei.gif",
  "img/room_option_trip.gif",
  "img/room_option_will.gif",
  "img/room_option_lovers.gif",
  "img/room_option_gm.gif",
  "img/user_regist_title.gif",
  "img/user_regist_handle_name.gif",
  "img/user_regist_handle_trip.gif",
  "img/user_regist_role.gif",
  "img/user_regist_role_none.gif",
  "img/user_regist_role_human.gif",
  "img/user_regist_role_wolf.gif",
  "img/user_regist_role_mage.gif",
  "img/user_regist_role_necromancer.gif",
  "img/user_regist_role_mad.gif",
  "img/user_regist_role_guard.gif",
  "img/user_regist_role_common.gif",
  "img/user_regist_role_fox.gif",
  "img/user_regist_role_betr.gif",
  "img/user_regist_icon.gif",
  "img/objection.gif",
  "img/victory_role_human.gif",
  "img/victory_role_wolf.gif",
  "img/victory_role_fox.gif",
  "img/victory_role_draw.gif",
  "img/victory_role_lovers.gif",
  "user_icon/001.gif",
  "user_icon/002.gif",
  "user_icon/003.gif",
  "user_icon/004.gif",
  "user_icon/005.gif",
  "user_icon/006.gif",
  "user_icon/007.gif",
  "user_icon/008.gif",
  "user_icon/009.gif",
  "user_icon/010.gif",
  "img/dummy_boy_user_icon.gif",
  "img/grave.gif"
];

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function wranglerArgs(bucket, key, file, config, storageMode, persistTo) {
  const args = ["wrangler", "r2", "object", "put", `${bucket}/${key}`, "--file", file];
  if (config) {
    args.push("--config", config);
  }
  if (storageMode) {
    args.push(`--${storageMode}`);
  }
  if (persistTo) {
    args.push("--persist-to", persistTo);
  }
  return args;
}

export function plannedReferenceAssetUploads({
  refRoot = DEFAULT_REF_ROOT,
  bucket = DEFAULT_BUCKET,
  prefix = DEFAULT_PREFIX,
  config = "",
  storageMode = "",
  persistTo = ""
} = {}) {
  return PRIORITY_ASSETS.map((assetPath) => {
    const file = resolve(refRoot, assetPath);
    const key = `${prefix}/${assetPath}`;
    return {
      assetPath,
      file,
      key,
      command: ["npx", ...wranglerArgs(bucket, key, file, config, storageMode, persistTo)]
    };
  });
}

const isMain = resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url);
if (isMain) {
  const refRoot = readArg("ref-root", DEFAULT_REF_ROOT);
  const bucket = readArg("bucket", DEFAULT_BUCKET);
  const prefix = readArg("prefix", DEFAULT_PREFIX);
  const config = readArg("config", "");
  const persistTo = readArg("persist-to", "");
  const local = hasFlag("local");
  const remote = hasFlag("remote");
  const yes = hasFlag("yes");
  if (local && remote) {
    console.error("Choose either --local or --remote, not both.");
    process.exit(1);
  }
  const storageMode = local ? "local" : remote ? "remote" : "";
  const plan = plannedReferenceAssetUploads({ refRoot, bucket, prefix, config, storageMode, persistTo });
  const missing = plan.filter((item) => !existsSync(item.file));
  if (missing.length) {
    console.error("Missing reference asset files:");
    for (const item of missing) {
      console.error(`- ${item.assetPath}`);
    }
    process.exit(1);
  }

  if (!yes) {
    console.log(`Dry run: ${plan.length} reference assets would be uploaded to R2 bucket ${bucket} with prefix ${prefix}.`);
    for (const item of plan) {
      console.log(item.command.map((part) => JSON.stringify(part)).join(" "));
    }
    console.log("Re-run with --yes to execute.");
    process.exit(0);
  }

  for (const item of plan) {
    const [, ...args] = item.command;
    const result = spawnSync("npx", args, { stdio: "inherit" });
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}
