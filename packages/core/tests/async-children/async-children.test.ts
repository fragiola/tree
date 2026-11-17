// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { asyncChildren } from "../../src/async-children/async-children";
import {
    createTreeEngine,
    type TreeEngine,
} from "../../src/engine/tree-engine";
import type { FeatureModel } from "../../src/features/types";
import { createTreeModel } from "../../src/state/model";
import { bareFiles, type FileTypes, files, filesModel } from "../fixture";

const engines: TreeEngine<FileTypes, readonly never[]>[] = [];
afterEach(() => {
    for (const engine of engines.splice(0)) engine.destroy();
});

const loose = (model: object) => model as unknown as FeatureModel;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the async children feature", () => {
    it("gives a loading item aria-busy and data-loading, a failed one data-load-error", () => {
        const model = filesModel({}, { features: [asyncChildren()] });
        model.run("item.set-children-status", {
            itemId: "lib",
            status: "loading",
        });
        expect(model.get("item-attributes-by", { itemId: "lib" })).toEqual({
            "aria-busy": "true",
            "data-loading": "",
        });
        model.run("item.set-children-status", {
            itemId: "lib",
            status: "error",
        });
        expect(model.get("item-attributes-by", { itemId: "lib" })).toEqual({
            "data-load-error": "",
        });
    });

    it("without it: a document with a childrenStatus does not load, and loadChildren is never called", () => {
        expect(() => createTreeModel(files())).toThrow(
            "/items/lib/childrenStatus requires the async-children feature",
        );
        const model = createTreeModel(
            bareFiles({ expandedItemIds: ["src", "lib"] }),
        );
        let calls = 0;
        const engine = createTreeEngine(model, {
            loadChildren: async () => {
                calls++;
                return [];
            },
        });
        engines.push(engine as never);
        expect(calls).toBe(0);
        expect(
            (
                engine as unknown as {
                    check(key: string, payload: object): unknown;
                }
            ).check("load-children", { itemId: "lib" }),
        ).toMatchObject({ ok: false, error: { code: "not_found" } });
        expect(
            loose(model).get("children-status-by", { itemId: "lib" }),
        ).toBeUndefined();
        expect(
            loose(model).run("item.set-children-status", {
                itemId: "lib",
                status: "loading",
            }),
        ).toMatchObject({ ok: false, error: { code: "not_found" } });
    });

    it("two engines on one model: one load, and a destroyed engine's load resets for the other", async () => {
        const model = filesModel({}, { features: [asyncChildren()] });
        const resolves: ((items: never[]) => void)[] = [];
        const loadChildren = () =>
            new Promise<never[]>((resolve) => {
                resolves.push(resolve);
            });
        const first = createTreeEngine(model, {
            loadChildren,
            resetLoadsOnDestroy: true,
        });
        const second = createTreeEngine(model, { loadChildren });
        engines.push(second as never);
        model.run("item.expand", { itemId: "lib" });
        // the first engine started the load: the second sees it loading and waits
        expect(resolves).toHaveLength(1);
        first.destroy();
        // the destroyed engine put it back to unloaded: the second loads it again
        expect(resolves).toHaveLength(2);
        resolves[1]?.([]);
        await flush();
        expect(model.get("children-status-by", { itemId: "lib" })).toBe(
            "loaded",
        );
    });
});
