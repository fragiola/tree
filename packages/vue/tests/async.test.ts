import { describe, expect, it, vi } from "vitest";
import { createTreeRef, type TreeItemJson } from "../src";
import {
    type FileTypes,
    filesModel,
    fileTree,
    itemElement,
    render,
    settle,
} from "./tree";

type Load = {
    resolve: (items: TreeItemJson<FileTypes>[]) => void;
    reject: (error: unknown) => void;
    signal: AbortSignal;
};

function loader() {
    const loads: Load[] = [];
    const loadChildren = vi.fn(
        (_item: unknown, { signal }: { signal: AbortSignal }) =>
            new Promise<TreeItemJson<FileTypes>[]>((resolve, reject) => {
                loads.push({ resolve, reject, signal });
            }),
    );
    return { loads, loadChildren };
}

const status = () => document.querySelector('[role="status"]');

describe("async children", () => {
    it("loads an unloaded item when it is expanded, then renders its children", async () => {
        const model = filesModel();
        const { loads, loadChildren } = loader();
        await render(() => fileTree({ model, loadChildren }));
        model.run("item.expand", { itemId: "lib" });
        await settle();
        expect(loadChildren).toHaveBeenCalledTimes(1);
        expect(itemElement("lib")).toHaveAttribute("data-loading", "");
        loads[0]?.resolve([
            { id: "x", kind: "file", label: "x.ts", data: { size: 1 } },
        ]);
        await settle();
        expect(itemElement("x.ts")).toHaveAttribute("aria-level", "3");
        expect(itemElement("lib")).not.toHaveAttribute("data-loading");
    });

    it("loads an item expanded in the document once mounted, and again after a remount", async () => {
        const model = filesModel({ expandedItemIds: ["src", "lib"] });
        const { loads, loadChildren } = loader();
        const first = await render(() => fileTree({ model, loadChildren }));
        expect(loads).toHaveLength(1);
        // a remount (a route change): the first engine's load is aborted, the next one loads
        first.unmount();
        expect(loads[0]?.signal.aborted).toBe(true);
        await render(() => fileTree({ model, loadChildren }));
        const live = loads.filter((load) => !load.signal.aborted);
        expect(live).toHaveLength(1);
        live[0]?.resolve([]);
        await settle();
        expect(model.get("children-status-by", { itemId: "lib" })).toBe(
            "loaded",
        );
    });

    it("marks a failed load, announces it, and retries through the engine", async () => {
        const model = filesModel();
        const { loads, loadChildren } = loader();
        const tree = createTreeRef<FileTypes>();
        await render(() =>
            fileTree({
                model,
                loadChildren,
                announce: (event) =>
                    event.type === "load-error"
                        ? `Could not load ${event.itemId}`
                        : undefined,
                treeRef: tree,
            }),
        );
        model.run("item.expand", { itemId: "lib" });
        await settle();
        loads[0]?.reject(new Error("offline"));
        await settle();
        expect(itemElement("lib")).toHaveAttribute("data-load-error", "");
        expect(status()).toHaveTextContent("Could not load lib");
        tree.value?.engine.run("load-children", { itemId: "lib" });
        await settle();
        expect(loadChildren).toHaveBeenCalledTimes(2);
        expect(itemElement("lib")).toHaveAttribute("data-loading", "");
    });

    it("aborts a load when the tree unmounts", async () => {
        const model = filesModel();
        const { loads, loadChildren } = loader();
        const wrapper = await render(() => fileTree({ model, loadChildren }));
        model.run("item.expand", { itemId: "lib" });
        await settle();
        wrapper.unmount();
        expect(loads[0]?.signal.aborted).toBe(true);
    });
});
