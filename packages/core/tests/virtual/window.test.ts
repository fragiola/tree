import { describe, expect, it } from "vitest";
import { scrollTargetForSpan } from "../../src/virtual/scroll-target";
import { FixedSizes } from "../../src/virtual/sizes";
import { visibleRange, windowFor } from "../../src/virtual/window";

describe("the window", () => {
    const axis = new FixedSizes(1000, 20);

    it("is the rows in view plus the overscan", () => {
        expect(visibleRange(axis, 100, 200)).toEqual({ start: 5, end: 15 });
        const window = windowFor(axis, 100, 200, 3);
        expect(window.rendered).toEqual({ start: 2, end: 18 });
        expect(windowFor(axis, 0, 0, 3).rendered).toEqual({ start: 0, end: 0 });
    });

    it("keeps its rendered rows while a scroll stays inside the overscan", () => {
        const first = windowFor(axis, 100, 200, 3);
        const same = windowFor(axis, 100, 200, 3, first, true);
        expect(same).toBe(first);
        const inside = windowFor(axis, 140, 200, 3, first, true);
        expect(inside.rendered).toBe(first.rendered);
        const out = windowFor(axis, 400, 200, 3, first, true);
        expect(out.rendered).toEqual({ start: 17, end: 33 });
    });

    it("scrolls a row into view by the least, or aligned", () => {
        // in view: no move
        expect(scrollTargetForSpan(100, 120, 0, 200, 20_000)).toBe(0);
        // below: its end at the view's end
        expect(scrollTargetForSpan(400, 420, 0, 200, 20_000)).toBe(220);
        // above: its start at the view's start
        expect(scrollTargetForSpan(40, 60, 100, 200, 20_000)).toBe(40);
        expect(scrollTargetForSpan(400, 420, 0, 200, 20_000, "center")).toBe(
            310,
        );
        expect(
            scrollTargetForSpan(19_980, 20_000, 0, 200, 20_000, "start"),
        ).toBe(19_800);
    });
});
