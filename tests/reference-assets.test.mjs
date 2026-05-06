import { describe, expect, it } from "vitest";
import { inventoryReferenceAssets } from "../scripts/inventory-reference-assets.mjs";

describe("reference asset inventory", () => {
  it("classifies reference browser assets without metadata files", async () => {
    const categories = await inventoryReferenceAssets();
    const byName = new Map(categories.map((category) => [category.category, category]));

    expect(categories.reduce((sum, category) => sum + category.count, 0)).toBe(130);
    expect(byName.get("page chrome")?.files).toContain("img/top_title.jpg");
    expect(byName.get("room option icons")?.files).toContain("img/room_option_wish_role.gif");
    expect(byName.get("role and result icons")?.files).toContain("img/role_wolf.gif");
    expect(byName.get("victory images")?.files).toContain("img/victory_role_human.gif");
    expect(byName.get("default user icons")?.files).toContain("user_icon/001.gif");
    expect(byName.get("legacy sounds")?.files).toContain("swf/sound_morning.swf");
    expect(categories.flatMap((category) => category.files)).not.toContain("img/Thumbs.db");
  });
});
