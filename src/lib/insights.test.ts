import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasTranslation, insightText, RULE_IDS } from "./insights";

describe("cleanup rules", () => {
  const rust = readFileSync(new URL("../../src-tauri/src/insights.rs", import.meta.url), "utf8");
  const ids = [...rust.matchAll(/id: "([a-z0-9-]+)"/g)].map((m) => m[1]);

  it("every Rust rule has an English and a Spanish explanation", () => {
    expect(ids.length).toBeGreaterThan(20);
    for (const id of ids) {
      expect(RULE_IDS, id).toContain(id);
      expect(hasTranslation("es", id), id).toBe(true);
      expect(insightText("en", id).desc.length, id).toBeGreaterThan(10);
    }
  });

  it("falls back to English", () => {
    expect(insightText("de", "node-modules").title).toBe("node_modules");
  });
});
