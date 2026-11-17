// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { CommandEvent } from "../../src/commands/types";
import type { AnnounceEvent } from "../../src/engine/host";
import {
    createTreeEngine,
    type TreeEngine,
} from "../../src/engine/tree-engine";
import type { TreeItemJson } from "../../src/state/json";
import { type FileTypes, filesModel } from "../fixture";

/** A loader whose loads the test settles by hand. */
function deferredLoader() {
    const calls: {
        itemId: string;
        signal: AbortSignal;
        resolve: (items: TreeItemJson<FileTypes>[]) => void;
        reject: (error: unknown) => void;
    }[] = [];
    const loadChildren = (
        item: { id: string },
        { signal }: { signal: AbortSignal },
    ) =>
        new Promise<TreeItemJson<FileTypes>[]>((resolve, reject) => {
            calls.push({ itemId: item.id, signal, resolve, reject });
        });
    return { calls, loadChildren };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let engine: TreeEngine<FileTypes> | undefined;
afterEach(() => {
    engine?.destroy();
    engine = undefined;
});

describe("async children", () => {
    it("expanding an unloaded item loads it: loading, then the children", async () => {
        const model = filesModel();
        const loader = deferredLoader();
        engine = createTreeEngine(model, { loadChildren: loader.loadChildren });
        const events: CommandEvent<FileTypes>[] = [];
        model.subscribe((event) => events.push(event));
        expect(loader.calls).toEqual([]);
        model.run("item.expand", { itemId: "lib" });
        expect(loader.calls.map((call) => call.itemId)).toEqual(["lib"]);
        expect(model.is("item-loading", { itemId: "lib" })).toBe(true);
        loader.calls[0]?.resolve([
            { id: "index", kind: "file", label: "index.ts", data: { size: 1 } },
        ]);
        await flush();
        expect(model.get("children-status-by", { itemId: "lib" })).toBe(
            "loaded",
        );
        expect(
            model
                .get("child-items-by", { itemId: "lib" })
                .map((item) => item.id),
        ).toEqual(["index"]);
        expect(events.map((event) => event.command)).toEqual([
            "item.expand",
            "item.set-children-status",
            "item.set-children",
        ]);
    });

    it("loads at creation what is already expanded and unloaded, and only visible items", async () => {
        const model = filesModel({ expandedItemIds: ["lib"] });
        const loader = deferredLoader();
        engine = createTreeEngine(model, { loadChildren: loader.loadChildren });
        // lib is expanded but src is not: lib is hidden
        expect(loader.calls).toEqual([]);
        model.run("item.expand", { itemId: "src" });
        expect(loader.calls.map((call) => call.itemId)).toEqual(["lib"]);
    });

    it("an error marks the item, is announced, and load-children retries", async () => {
        const model = filesModel();
        const loader = deferredLoader();
        const announced: AnnounceEvent[] = [];
        engine = createTreeEngine(model, {
            loadChildren: loader.loadChildren,
            announce: (event) => {
                announced.push(event);
                return event.type === "load-error"
                    ? "Could not load lib"
                    : undefined;
            },
        });
        model.run("item.expand", { itemId: "lib" });
        expect(engine.can("load-children", { itemId: "lib" })).toBe(false);
        loader.calls[0]?.reject(new Error("offline"));
        await flush();
        expect(model.get("children-status-by", { itemId: "lib" })).toBe(
            "error",
        );
        expect(announced).toMatchObject([
            { type: "load-error", itemId: "lib" },
        ]);
        expect(engine.get("announcement")).toBe("Could not load lib");
        expect(engine.run("load-children", { itemId: "lib" })).toEqual({
            ok: true,
            value: { itemId: "lib" },
        });
        expect(model.is("item-loading", { itemId: "lib" })).toBe(true);
        loader.calls[1]?.resolve([]);
        await flush();
        expect(model.get("children-status-by", { itemId: "lib" })).toBe(
            "loaded",
        );
        expect(
            engine.check("load-children", { itemId: "utils" }),
        ).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
    });

    it("collapsing during a load aborts nothing: the children still arrive", async () => {
        const model = filesModel();
        const loader = deferredLoader();
        engine = createTreeEngine(model, { loadChildren: loader.loadChildren });
        model.run("item.expand", { itemId: "lib" });
        model.run("item.collapse", { itemId: "lib" });
        expect(loader.calls[0]?.signal.aborted).toBe(false);
        loader.calls[0]?.resolve([
            { id: "x", kind: "file", label: "x", data: { size: 1 } },
        ]);
        await flush();
        expect(model.get("children-status-by", { itemId: "lib" })).toBe(
            "loaded",
        );
    });

    it("a reset during a load makes its result stale", async () => {
        const model = filesModel();
        const loader = deferredLoader();
        engine = createTreeEngine(model, { loadChildren: loader.loadChildren });
        model.run("item.expand", { itemId: "lib" });
        model.run("item.collapse", { itemId: "lib" });
        model.run("item.reset-children", { itemId: "lib" });
        loader.calls[0]?.resolve([
            { id: "x", kind: "file", label: "x", data: { size: 1 } },
        ]);
        await flush();
        expect(model.get("children-status-by", { itemId: "lib" })).toBe(
            "unloaded",
        );
    });

    it("destroy aborts the loads, and no command runs after it", async () => {
        const model = filesModel();
        const loader = deferredLoader();
        engine = createTreeEngine(model, { loadChildren: loader.loadChildren });
        model.run("item.expand", { itemId: "lib" });
        const events: CommandEvent<FileTypes>[] = [];
        model.subscribe((event) => events.push(event));
        engine.destroy();
        expect(loader.calls[0]?.signal.aborted).toBe(true);
        loader.calls[0]?.resolve([
            { id: "x", kind: "file", label: "x", data: { size: 1 } },
        ]);
        await flush();
        expect(events).toEqual([]);
        expect(model.is("item-loading", { itemId: "lib" })).toBe(true);
        // nor from the engine's verbs, nor a later expand
        expect(engine.run("load-children", { itemId: "lib" })).toMatchObject({
            ok: false,
        });
        model.run("item.reset-children", { itemId: "lib" });
        model.run("item.expand", { itemId: "lib" });
        expect(loader.calls).toHaveLength(1);
    });

    it("without a loader nothing loads, and load-children says why", () => {
        const model = filesModel();
        engine = createTreeEngine(model);
        model.run("item.expand", { itemId: "lib" });
        expect(model.get("children-status-by", { itemId: "lib" })).toBe(
            "unloaded",
        );
        expect(engine.check("load-children", { itemId: "lib" })).toMatchObject({
            ok: false,
            error: {
                code: "refused",
                message: "the engine has no loadChildren",
            },
        });
    });
});
