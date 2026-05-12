import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

const scriptPath = "scripts/capture-visual-parity.mjs";

function runScript(args = [], env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], { env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

describe("visual parity capture script", () => {
  it("prints a dry-run capture matrix without requiring confirmation", async () => {
    const result = await runScript([
      "--dry-run",
      "--output-dir=tmp/screens",
      "--report=tmp/report.md",
      "http://127.0.0.1:8787"
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Visual parity capture plan");
    expect(result.stdout).toContain("plan home desktop / -> tmp/screens/home-desktop.png");
    expect(result.stdout).toContain("plan room-lobby mobile /room/:roomId -> tmp/screens/room-lobby-mobile.png");
    expect(result.stdout).toContain("plan game-vote tablet /game_vote.php?room_no=:roomId&auto_reload=20");
  });

  it("requires confirmation before creating room data and screenshots", async () => {
    const result = await runScript(["http://127.0.0.1:8787"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Pass --yes");
  });

  it("adds stateful day, night, ended, and old-log captures when requested", async () => {
    const result = await runScript([
      "--dry-run",
      "--include-game-states",
      "--output-dir=tmp/screens",
      "http://127.0.0.1:8787"
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("plan room-day desktop /room/:roomId -> tmp/screens/room-day-desktop.png");
    expect(result.stdout).toContain("plan room-night tablet /room/:roomId -> tmp/screens/room-night-tablet.png");
    expect(result.stdout).toContain("plan room-ended mobile /room/:roomId -> tmp/screens/room-ended-mobile.png");
    expect(result.stdout).toContain("plan old-log-public desktop /old_log.php?log_mode=on&room_no=:roomId");
    expect(result.stdout).toContain("plan old-log-player tablet /old_log.php?log_mode=on&room_no=:roomId&viewer=player&viewer_player_id=:playerId&heaven_talk=on");
    expect(result.stdout).toContain("plan old-log-dead mobile /old_log.php?log_mode=on&room_no=:roomId&viewer=dead&heaven_talk=on");
    expect(result.stdout).toContain("plan old-log-gm desktop /old_log.php?log_mode=on&room_no=:roomId&viewer=gm&heaven_talk=on");
  });

  it("rejects invalid Worker URLs", async () => {
    const result = await runScript(["--dry-run", "ftp://example.test"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Worker URL must use http or https");
  });
});
