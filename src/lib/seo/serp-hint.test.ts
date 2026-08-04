import { describe, expect, it } from "vitest";
import {
  computeSeoHint,
  DESCRIPTION_DANGER_AT,
  DESCRIPTION_MIN,
  DESCRIPTION_WARN_AT,
  descriptionCounterCopy,
  TITLE_DANGER_AT,
  TITLE_MIN,
  TITLE_WARN_AT,
  titleCounterCopy,
} from "./serp-hint";
import { DESCRIPTION_HARD_MAX, TITLE_HARD_MAX } from "./metadata";

describe("thresholds", () => {
  it("track docs/11 §3's exact length-budget table, via the shared metadata constants", () => {
    expect(TITLE_MIN).toBe(35);
    expect(TITLE_WARN_AT).toBe(60);
    expect(TITLE_DANGER_AT).toBe(TITLE_HARD_MAX);
    expect(TITLE_HARD_MAX).toBe(65);
    expect(DESCRIPTION_MIN).toBe(110);
    expect(DESCRIPTION_WARN_AT).toBe(160);
    expect(DESCRIPTION_DANGER_AT).toBe(DESCRIPTION_HARD_MAX);
    expect(DESCRIPTION_HARD_MAX).toBe(165);
  });
});

describe("titleCounterCopy", () => {
  it("is neutral within the target band", () => {
    expect(titleCounterCopy(50).className).toBe("text-on-surface-variant");
  });

  it("warns amber just below the minimum", () => {
    expect(titleCounterCopy(TITLE_MIN - 1).className).toBe("text-warning");
  });

  it("never warns short for an empty title (that's the 'add a title' case, not 'too short')", () => {
    expect(titleCounterCopy(0).className).toBe("text-on-surface-variant");
  });

  it("warns amber just above the soft max", () => {
    expect(titleCounterCopy(TITLE_WARN_AT + 1).className).toBe("text-warning");
  });

  it("goes red past the hard max", () => {
    const result = titleCounterCopy(TITLE_DANGER_AT + 1);
    expect(result.className).toBe("text-danger");
    expect(result.text).toContain("too long");
  });
});

describe("descriptionCounterCopy", () => {
  it("is neutral within the target band", () => {
    expect(descriptionCounterCopy(140).className).toBe("text-on-surface-variant");
  });

  it("warns amber just below the minimum", () => {
    expect(descriptionCounterCopy(DESCRIPTION_MIN - 1).className).toBe("text-warning");
  });

  it("warns amber just above the soft max", () => {
    expect(descriptionCounterCopy(DESCRIPTION_WARN_AT + 1).className).toBe("text-warning");
  });

  it("goes red past the hard max", () => {
    const result = descriptionCounterCopy(DESCRIPTION_DANGER_AT + 1);
    expect(result.className).toBe("text-danger");
    expect(result.text).toContain("too long");
  });
});

describe("computeSeoHint", () => {
  const goodTitle = "HP Victus 15 Gaming Laptop Price in Nepal";
  const goodDescription =
    "HP Victus 15 gaming laptop with Ryzen 7, RTX 4060, 16GB RAM, and 512GB SSD. " +
    "In stock at City Computer Systems with warranty and free delivery across Nepal.";

  it("reports looksGood when both fields are in-band and mention the entity name", () => {
    const hint = computeSeoHint({
      title: goodTitle,
      description: goodDescription,
      entityName: "HP Victus 15",
    });
    expect(hint.looksGood).toBe(true);
    expect(hint.issues).toEqual([]);
  });

  it("flags an empty title distinctly from a too-short one", () => {
    const hint = computeSeoHint({ title: "", description: goodDescription });
    expect(hint.looksGood).toBe(false);
    expect(hint.issues).toContain("Add a page title");
  });

  it("flags a too-short title once it's non-empty but under the minimum", () => {
    const hint = computeSeoHint({ title: "HP Victus", description: goodDescription });
    expect(hint.issues).toContain("Page title is a bit short");
  });

  it("flags a too-long description", () => {
    const longDescription = "x".repeat(DESCRIPTION_DANGER_AT + 10);
    const hint = computeSeoHint({ title: goodTitle, description: longDescription });
    expect(hint.looksGood).toBe(false);
    expect(hint.issues).toContain("Search description is too long");
  });

  it("flags when the title doesn't mention the entity name", () => {
    const hint = computeSeoHint({
      title: goodTitle,
      description: goodDescription,
      entityName: "Dell XPS 13",
    });
    expect(hint.issues).toContain("Page title doesn't mention the product name");
  });

  it("skips the entity-name check entirely when no entityName is given (e.g. a CMS page)", () => {
    const hint = computeSeoHint({ title: goodTitle, description: goodDescription });
    expect(hint.issues.some((issue) => issue.includes("mention"))).toBe(false);
  });
});
