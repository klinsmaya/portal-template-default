import { describe, expect, it } from "vitest";

import { COALESCE_MS, initHistory, recordDraft, redoDraft, undoDraft } from "@/lib/dingze/draft-history";

describe("draft undo / redo", () => {
  it("collapses a typing burst into one step and steps back and forth", () => {
    let h = initHistory("");
    h = recordDraft(h, "a", 1000);
    h = recordDraft(h, "ab", 1000 + 100);
    h = recordDraft(h, "abc", 1000 + 200);
    h = recordDraft(h, "abc!", 1000 + 200 + COALESCE_MS + 1);
    expect(h.past).toEqual(["", "abc"]);
    h = undoDraft(h);
    expect(h.present).toBe("abc");
    h = undoDraft(h);
    expect(h.present).toBe("");
    expect(undoDraft(h)).toBe(h);
    h = redoDraft(h);
    expect(h.present).toBe("abc");
  });

  it("drops the redo branch on a new edit and keeps discrete edits separate", () => {
    let h = initHistory(1);
    h = recordDraft(h, 2, 0, false);
    h = recordDraft(h, 3, 1, false);
    h = undoDraft(h);
    h = recordDraft(h, 9, 2, false);
    expect(h).toMatchObject({ past: [1, 2], present: 9, future: [] });
  });
});
