import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultRefRoot = join(projectRoot, "ref/diam1.3.61.kz_Build0912");
const defaultPortFiles = {
  render: join(projectRoot, "src/render.ts"),
  capture: join(projectRoot, "scripts/capture-visual-parity.mjs")
};

const checks = [
  {
    name: "top page chrome",
    reference: [
      ["index.php", 'background-image: url("img/top_bg.jpg")'],
      ["index.php", 'img/top_title.jpg'],
      ["index.php", "border:1px solid #CC3300;"],
      ["index.php", 'bgcolor="#CCFFCC"']
    ],
    port: [
      ["render", 'background-image: url("/assets/reference/img/top_bg.jpg")'],
      ["render", '/assets/reference/img/top_title.jpg'],
      ["render", ".menu-box { width: 140px; border: 1px solid #cc3300; }"],
      ["render", ".menu-box th { background: #ccffcc; padding: 5px; }"]
    ]
  },
  {
    name: "old log chrome and transcript colors",
    reference: [
      ["old_log.php", 'img/old_log_bg.jpg'],
      ["old_log.php", 'img/old_log_title.jpg'],
      ["old_log.php", 'bgcolor="#CCCCCC"'],
      ["old_log.php", "background-color:#999900;color:snow;font-weight:bold"],
      ["old_log.php", "background-color:#CC3300;color:snow;font-weight:bold"],
      ["old_log.php", "background-color:#990099;color:snow;font-weight:bold"],
      ["old_log.php", "background-color:#0099FF;color:snow;font-weight:bold"]
    ],
    port: [
      ["render", "/assets/reference/img/old_log_bg.jpg"],
      ["render", "/assets/reference/img/old_log_title.jpg"],
      ["render", 'bgcolor="#CCCCCC"'],
      ["render", ".transcript-location-vote td { background: #999900; color: snow; font-weight: bold; }"],
      ["render", ".transcript-location-kill td { background: #cc3300; color: snow; font-weight: bold; }"],
      ["render", ".transcript-location-divination td { background: #990099; color: snow; font-weight: bold; }"],
      ["render", ".transcript-location-guard td { background: #0099ff; color: snow; font-weight: bold; }"]
    ]
  },
  {
    name: "legacy frame layout",
    reference: [
      ["game_frame.php", '<frameset rows="85,*"'],
      ["game_frame.php", 'frame name="up" src="game_up.php'],
      ["game_frame.php", 'frame name="bottom" src="game_play.php'],
      ["game_frame.php", "dead_mode=on"],
      ["game_frame.php", 'frame name="middle"']
    ],
    port: [
      ["render", '<frameset rows="85,*" border="0" frameborder="0" framespacing="0" data-legacy-entry="game_frame.php">'],
      ["render", '<frame name="up" src='],
      ["render", '<frame name="bottom" src='],
      ["render", "room-view-heaven"],
      ["render", "room-view-spectator"]
    ]
  },
  {
    name: "legacy upper frame controls",
    reference: [
      ["game_up.php", '<form name="send"'],
      ["game_up.php", 'target="bottom"'],
      ["game_up.php", 'name="vote_link"'],
      ["game_up.php", "GM_KILL"],
      ["game_up.php", "GM_CHANNEL"],
      ["game_up.php", "GM_DECL"]
    ],
    port: [
      ["render", 'class="legacy-send-form" name="send"'],
      ["render", 'target="bottom"'],
      ["render", 'name="vote_link_'],
      ["render", "GM_KILL"],
      ["render", "GM_CHANNEL"],
      ["render", "GM_DECL"]
    ]
  },
  {
    name: "legacy vote and GM action controls",
    reference: [
      ["game_vote.php", 'command value=vote'],
      ["game_vote.php", "table_votelist1"],
      ["game_vote.php", "GM_KILL"],
      ["game_vote.php", "GM_RESU"],
      ["game_vote.php", "GM_CHROLE"],
      ["game_vote.php", "GM_MARK"],
      ["game_vote.php", "GM_DEMARK"],
      ["game_vote.php", "GM_CHANNEL"],
      ["game_vote.php", "GM_DECL"]
    ],
    port: [
      ["render", 'class="legacy-vote-form" name="game_vote"'],
      ["render", "table_votelist1"],
      ["render", "GM_KILL"],
      ["render", "GM_RESU"],
      ["render", "GM_CHROLE"],
      ["render", "GM_MARK"],
      ["render", "GM_DEMARK"],
      ["render", "GM_CHANNEL"],
      ["render", "GM_DECL"]
    ]
  },
  {
    name: "automated visual capture coverage",
    reference: [
      ["index.php", "top_title.jpg"],
      ["game_frame.php", "game_up.php"],
      ["game_up.php", "game_vote.php"],
      ["game_vote.php", "GM_CHANNEL"],
      ["old_log.php", "old_log_title.jpg"]
    ],
    port: [
      ["capture", '{ name: "home", path: "/" }'],
      ["capture", '{ name: "game-frame", path: `/game_frame.php?room_no=${roomId}&auto_reload=20` }'],
      ["capture", '{ name: "game-up", path: `/game_up.php?room_no=${roomId}&auto_reload=20` }'],
      ["capture", '{ name: "game-vote", path: `/game_vote.php?room_no=${roomId}&auto_reload=20` }'],
      ["capture", '{ name: "room-gm-controls", path: `/room/${roomId}` }'],
      ["capture", '{ name: "old-log-gm", path: `/old_log.php?log_mode=on&room_no=${roomId}&viewer=gm&heaven_talk=on` }']
    ]
  }
];

async function readReferenceFile(refRoot, file) {
  return readFile(join(refRoot, file), "utf8");
}

async function readPortFiles(portFiles) {
  return {
    render: await readFile(portFiles.render, "utf8"),
    capture: await readFile(portFiles.capture, "utf8")
  };
}

function missingNeedles(contentsByKey, requirements, side, checkName) {
  return requirements
    .filter(([key, needle]) => !contentsByKey[key]?.replaceAll('\\"', '"').includes(needle))
    .map(([key, needle]) => `${checkName}: ${side} ${key} is missing ${JSON.stringify(needle)}`);
}

export async function checkReferenceVisualParity(options = {}) {
  const refRoot = options.refRoot ?? defaultRefRoot;
  const portFiles = { ...defaultPortFiles, ...(options.portFiles ?? {}) };
  const referenceFiles = new Map();
  const failures = [];

  for (const check of checks) {
    for (const [file] of check.reference) {
      if (!referenceFiles.has(file)) {
        referenceFiles.set(file, await readReferenceFile(refRoot, file));
      }
    }
  }

  const portContents = await readPortFiles(portFiles);
  const referenceContents = Object.fromEntries(referenceFiles.entries());

  for (const check of checks) {
    failures.push(...missingNeedles(referenceContents, check.reference, "reference", check.name));
    failures.push(...missingNeedles(portContents, check.port, "port", check.name));
  }

  return {
    passed: failures.length === 0,
    failures,
    checked: checks.map((check) => check.name)
  };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const result = await checkReferenceVisualParity();
  if (!result.passed) {
    console.error("Reference visual parity check failed:");
    for (const failure of result.failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }
  console.log(`Reference visual parity check passed (${result.checked.length} checks)`);
}
