import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkReferenceVisualParity } from "../scripts/check-reference-visual-parity.mjs";

describe("reference visual parity checker", () => {
  it("passes against the checked-in reference PHP and current visual implementation", async () => {
    const result = await checkReferenceVisualParity();

    expect(result.failures).toEqual([]);
    expect(result.checked).toContain("top page chrome");
    expect(result.checked).toContain("automated visual capture coverage");
  });

  it("reports missing current-port visual markers", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "werewolf-reference-visual-"));
    const refRoot = join(tempRoot, "ref");
    const portRoot = join(tempRoot, "port");
    await mkdir(refRoot, { recursive: true });
    await mkdir(portRoot, { recursive: true });

    await writeFile(join(refRoot, "index.php"), [
      'background-image: url("img/top_bg.jpg")',
      "img/top_title.jpg",
      "border:1px solid #CC3300;",
      'bgcolor="#CCFFCC"'
    ].join("\n"));
    await writeFile(join(refRoot, "old_log.php"), [
      "img/old_log_bg.jpg",
      "img/old_log_title.jpg",
      'bgcolor="#CCCCCC"',
      "background-color:#999900;color:snow;font-weight:bold",
      "background-color:#CC3300;color:snow;font-weight:bold",
      "background-color:#990099;color:snow;font-weight:bold",
      "background-color:#0099FF;color:snow;font-weight:bold"
    ].join("\n"));
    await writeFile(join(refRoot, "game_frame.php"), [
      '<frameset rows="85,*"',
      'frame name="up" src="game_up.php',
      'frame name="bottom" src="game_play.php',
      "dead_mode=on",
      'frame name="middle"'
    ].join("\n"));
    await writeFile(join(refRoot, "game_up.php"), [
      '<form name="send"',
      'target="bottom"',
      'name="vote_link"',
      "GM_KILL",
      "GM_CHANNEL",
      "GM_DECL",
      "game_vote.php"
    ].join("\n"));
    await writeFile(join(refRoot, "game_vote.php"), [
      "command value=vote",
      "table_votelist1",
      "GM_KILL",
      "GM_RESU",
      "GM_CHROLE",
      "GM_MARK",
      "GM_DEMARK",
      "GM_CHANNEL",
      "GM_DECL"
    ].join("\n"));

    await writeFile(join(portRoot, "render.ts"), "partial render without legacy markers");
    await writeFile(join(portRoot, "capture.mjs"), '{ name: "home", path: "/" }');

    const result = await checkReferenceVisualParity({
      refRoot,
      portFiles: {
        render: join(portRoot, "render.ts"),
        capture: join(portRoot, "capture.mjs")
      }
    });

    expect(result.passed).toBe(false);
    expect(result.failures).toContain('top page chrome: port render is missing "background-image: url(\\"/assets/reference/img/top_bg.jpg\\")"');
    expect(result.failures).toContain('legacy vote and GM action controls: port render is missing "GM_DECL"');
    expect(result.failures).toContain('automated visual capture coverage: port capture is missing "{ name: \\"room-gm-controls\\", path: `/room/${roomId}` }"');
  });
});
