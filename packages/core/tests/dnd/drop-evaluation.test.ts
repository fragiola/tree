// The drop evaluation on synthetic visible lists, as React Complex Tree's DraggingPositionEvaluation
// is exercised: no DOM, no model.
import { describe, expect, it } from "vitest";
import {
    type DropContext,
    evaluateDrop,
    hoverOffset,
    viablePositions,
} from "../../src/dnd/drop-evaluation";
import type { VisibleItem } from "../../src/state/types";

// root
//   a            (folder, expanded)
//     a1
//     a2         (folder, expanded)
//       a2x
//   b            (folder, collapsed)
//   c
const children: Record<string, string[]> = {
    root: ["a", "b", "c"],
    a: ["a1", "a2"],
    a2: ["a2x"],
    b: ["b1"],
};
const levels: [string, string | null, number][] = [
    ["a", null, 1],
    ["a1", "a", 2],
    ["a2", "a", 2],
    ["a2x", "a2", 3],
    ["b", null, 1],
    ["c", null, 1],
];
const visible: VisibleItem[] = levels.map(([itemId, parentItemId, level]) => {
    const siblings = children[parentItemId ?? "root"] ?? [];
    return {
        itemId,
        parentItemId,
        level,
        posinset: siblings.indexOf(itemId) + 1,
        setsize: siblings.length,
    };
});

function context(dragging: string[]): DropContext {
    return {
        visible,
        childIdsOf: (parent) => children[parent ?? "root"] ?? [],
        holdsChildren: (itemId) => itemId in children,
        draggingItemIds: dragging,
    };
}

const at = (itemId: string) =>
    visible.findIndex((entry) => entry.itemId === itemId);

describe("the hover offset", () => {
    it("thirds for a row that takes drops inside, halves otherwise; the last row's lower half is after", () => {
        expect(hoverOffset(0.2, true, false)).toBe("top");
        expect(hoverOffset(0.5, true, false)).toBeUndefined();
        expect(hoverOffset(0.8, true, false)).toBe("bottom");
        expect(hoverOffset(0.4, false, false)).toBe("top");
        expect(hoverOffset(0.6, false, false)).toBe("bottom");
        expect(hoverOffset(0.5, true, true)).toBe("bottom");
    });
});

describe("evaluateDrop", () => {
    it("before, after and inside an item", () => {
        const ctx = context(["c"]);
        expect(
            evaluateDrop(ctx, {
                index: at("a1"),
                offset: "top",
                indentation: undefined,
            }),
        ).toEqual({
            parentItemId: "a",
            index: 0,
            position: "before",
            itemId: "a1",
            level: 2,
        });
        expect(
            evaluateDrop(ctx, {
                index: at("b"),
                offset: undefined,
                indentation: undefined,
            }),
        ).toEqual({
            parentItemId: "b",
            index: 1,
            position: "inside",
            itemId: "b",
            level: 2,
        });
        expect(
            evaluateDrop(ctx, {
                index: at("b"),
                offset: "bottom",
                indentation: undefined,
            }),
        ).toEqual({
            parentItemId: null,
            index: 2,
            position: "after",
            itemId: "b",
            level: 1,
        });
    });

    it("the top of an item below its sibling is the sibling's bottom", () => {
        expect(
            evaluateDrop(context(["c"]), {
                index: at("a2"),
                offset: "top",
                indentation: undefined,
            }),
        ).toMatchObject({
            position: "after",
            itemId: "a1",
            parentItemId: "a",
            index: 1,
        });
    });

    it("the bottom of an open folder is the top of its contents", () => {
        expect(
            evaluateDrop(context(["c"]), {
                index: at("a"),
                offset: "bottom",
                indentation: undefined,
            }),
        ).toMatchObject({
            position: "before",
            itemId: "a1",
            parentItemId: "a",
            index: 0,
            level: 2,
        });
    });

    it("at the end of a sublist the inline offset chooses the level", () => {
        const ctx = context(["c"]);
        const below = (indentation: number) =>
            evaluateDrop(ctx, {
                index: at("a2x"),
                offset: "bottom",
                indentation,
            });
        // the deepest level: after a2x, inside a2
        expect(below(2)).toEqual({
            parentItemId: "a2",
            index: 1,
            position: "after",
            itemId: "a2x",
            level: 3,
        });
        // one level up: after a2, inside a
        expect(below(1)).toEqual({
            parentItemId: "a",
            index: 2,
            position: "after",
            itemId: "a2",
            level: 2,
        });
        // the root: after a
        expect(below(0)).toEqual({
            parentItemId: null,
            index: 1,
            position: "after",
            itemId: "a",
            level: 1,
        });
    });

    it("over a dragged item, inside one, or inside a leaf is invalid", () => {
        expect(
            evaluateDrop(context(["a2"]), {
                index: at("a2"),
                offset: undefined,
                indentation: undefined,
            }),
        ).toBe("invalid");
        expect(
            evaluateDrop(context(["a"]), {
                index: at("a2x"),
                offset: "top",
                indentation: undefined,
            }),
        ).toBe("invalid");
        expect(
            evaluateDrop(context(["b"]), {
                index: at("c"),
                offset: undefined,
                indentation: undefined,
            }),
        ).toBe("invalid");
    });

    it("nothing outside the rows; the root of an empty tree", () => {
        expect(
            evaluateDrop(context(["c"]), {
                index: 9,
                offset: "top",
                indentation: 0,
            }),
        ).toBeUndefined();
        expect(
            evaluateDrop(
                { ...context(["x"]), visible: [] },
                { index: 0, offset: undefined, indentation: undefined },
            ),
        ).toEqual({
            parentItemId: null,
            index: 0,
            position: "inside",
            itemId: null,
            level: 1,
        });
    });
});

describe("viablePositions", () => {
    it("lists every place once, skipping the dragged items' descendants", () => {
        const positions = viablePositions(context(["a2"])).map(
            (target) => `${target.position} ${target.itemId}`,
        );
        expect(positions).toEqual([
            "before a",
            "inside a",
            "before a1",
            // after a1 is before a2; inside a2 (dragged) and a2x (inside it) are skipped
            "after a1",
            "after a2",
            // the end of a's sublist, at the root level: after a
            "before b",
            "inside b",
            "after b",
            "after c",
        ]);
    });
});
