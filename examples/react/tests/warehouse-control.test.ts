import { createTreeModel } from "@fragiola/tree-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    createStockFeed,
    formatTime,
    type Movement,
    movementsOf,
    randomSource,
    START_TIME,
} from "../src/examples/_kit/warehouse-live";
import {
    applyMovements,
    binStocks,
    describe as describeItem,
    network,
    stockIn,
    storageRules,
} from "../src/examples/warehouse-control/warehouse";

// warehouse-control's live feed (the kit's, framework-free) and how a tick reaches the tree:
// seeded, bounded by each bin, applied as one batch through the storage rules, and the low-stock
// flag follows in the same state.

const modelOf = () => {
    const model = createTreeModel(network());
    storageRules(model);
    return model;
};

const ticks = (seed: number, count: number) => {
    const model = modelOf();
    const feed = createStockFeed({
        bins: () => binStocks(model),
        seed,
        autoplay: false,
    });
    const seen: Movement[] = [];
    feed.subscribe((movements) => {
        seen.push(...movements);
        applyMovements(model, movements);
    });
    for (let n = 0; n < count; n++) feed.step();
    feed.dispose();
    return { model, seen };
};

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("the stock feed", () => {
    it("gives the same movements for the same seed", () => {
        expect(ticks(3, 40).seen).toEqual(ticks(3, 40).seen);
        expect(ticks(3, 40).seen).not.toEqual(ticks(4, 40).seen);
    });

    it("never takes more than a bin holds, nor fills it past its capacity", () => {
        const random = randomSource(1);
        const next = { id: 1, time: START_TIME };
        const bins = [
            { id: "a", quantity: 2, capacity: 10, minimum: 5 },
            { id: "b", quantity: 10, capacity: 10, minimum: 5 },
        ];
        for (let n = 0; n < 200; n++)
            for (const movement of movementsOf(bins, random, next)) {
                expect(movement.quantity).toBeGreaterThanOrEqual(0);
                expect(movement.quantity).toBeLessThanOrEqual(10);
                expect(movement.delta).not.toBe(0);
            }
    });

    it("moves the model through commands the storage rules accept", () => {
        const { model, seen } = ticks(7, 60);
        expect(seen.length).toBeGreaterThan(60);
        // every movement landed: each bin holds what its last movement left
        const last = new Map(
            seen.map((movement) => [movement.binId, movement]),
        );
        for (const [binId, movement] of last) {
            const bin = model.get("item-by", { id: binId });
            expect(bin?.kind === "bin" && bin.data.quantity).toBe(
                movement.quantity,
            );
        }
    });

    it("flags a bin, and its locations, in the state the pick leaves", () => {
        const model = modelOf();
        const before = stockIn(model.state, "lisbon-dry-a1").low;
        applyMovements(model, [
            {
                id: 1,
                kind: "pick",
                binId: "lisbon-dry-a1-b1",
                delta: -80,
                quantity: 4,
                time: START_TIME,
            },
        ]);
        expect(describeItem(model.state, "lisbon-dry-a1-b1")).toBe(
            "4 of 120 units, low stock (minimum 20), Rice 5 kg",
        );
        expect(stockIn(model.state, "lisbon-dry-a1").low).toBe(before + 1);
        expect(stockIn(model.state, "").low).toBeGreaterThan(0);
    });

    it("plays on a timer, pauses, and stops while the document is hidden", () => {
        vi.useFakeTimers();
        const listeners = new Set<() => void>();
        const document = {
            visibilityState: "visible",
            addEventListener: (_type: string, listener: () => void) =>
                listeners.add(listener),
            removeEventListener: (_type: string, listener: () => void) =>
                listeners.delete(listener),
        };
        vi.stubGlobal("document", document);
        const model = modelOf();
        const feed = createStockFeed({
            bins: () => binStocks(model),
            interval: 100,
        });
        let count = 0;
        feed.subscribe(() => count++);
        expect(feed.playing).toBe(true);
        vi.advanceTimersByTime(1000);
        expect(count).toBe(10);

        document.visibilityState = "hidden";
        for (const listener of listeners) listener();
        vi.advanceTimersByTime(1000);
        expect(count).toBe(10);
        document.visibilityState = "visible";
        for (const listener of listeners) listener();
        vi.advanceTimersByTime(500);
        expect(count).toBe(15);

        feed.pause();
        vi.advanceTimersByTime(1000);
        expect(count).toBe(15);
        feed.dispose();
        expect(listeners.size).toBe(0);
    });

    it("starts paused when asked to (reduced motion)", () => {
        const feed = createStockFeed({ bins: () => [], autoplay: false });
        expect(feed.playing).toBe(false);
        feed.dispose();
    });

    it("tells the time of day", () => {
        expect(formatTime(START_TIME)).toBe("08:00:00");
        expect(formatTime(START_TIME + 3725)).toBe("09:02:05");
    });
});
