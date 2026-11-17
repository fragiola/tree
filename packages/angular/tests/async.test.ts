import { Component, input } from "@angular/core";
import { describe, expect, it, vi } from "vitest";
import {
    type LoadChildren,
    TREE,
    type TreeEngine,
    type TreeItemJson,
    type TreeModel,
} from "../src/public-api";
import {
    type FEATURES,
    type FileTypes,
    filesModel,
    itemElement,
    render,
    renderFiles,
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

/** A root the app removes from its template (`@if`) while the component stays. */
@Component({
    selector: "test-removable",
    imports: [TREE],
    template: `
        @if (shown()) {
            <div [treeRoot]="model()" [loadChildren]="loadChildren()" aria-label="Files">
                <ng-template treeItems let-item>
                    <div [treeItem]="item"><div treeItemContent>{{ item.label }}</div><div treeGroup></div></div>
                </ng-template>
            </div>
        }
    `,
})
class Removable {
    readonly model = input.required<TreeModel<FileTypes>>();
    readonly loadChildren = input.required<LoadChildren<FileTypes>>();
    readonly shown = input(true);
}

describe("async children", () => {
    it("loads an unloaded item when it is expanded, then renders its children", async () => {
        const model = filesModel();
        const { loads, loadChildren } = loader();
        await renderFiles({ model, loadChildren });
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
        const first = await renderFiles({ model, loadChildren });
        expect(loads).toHaveLength(1);
        // a remount (a route change): the first engine's load is aborted, the next one loads
        first.destroy();
        expect(loads[0]?.signal.aborted).toBe(true);
        await renderFiles({ model, loadChildren });
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
        // Angular: the root's handle (`#tree="treeRoot"`) in place of a tree ref
        const view = await renderFiles({
            model,
            loadChildren,
            announce: (event) =>
                event.type === "load-error"
                    ? `Could not load ${event.itemId}`
                    : undefined,
        });
        model.run("item.expand", { itemId: "lib" });
        await settle();
        loads[0]?.reject(new Error("offline"));
        await settle();
        expect(itemElement("lib")).toHaveAttribute("data-load-error", "");
        expect(status()).toHaveTextContent("Could not load lib");
        (
            view.component.root().engine as TreeEngine<
                FileTypes,
                typeof FEATURES
            >
        ).run("load-children", { itemId: "lib" });
        await settle();
        expect(loadChildren).toHaveBeenCalledTimes(2);
        expect(itemElement("lib")).toHaveAttribute("data-loading", "");
    });

    it("aborts a load when the tree unmounts", async () => {
        const model = filesModel();
        const { loads, loadChildren } = loader();
        const view = await renderFiles({ model, loadChildren });
        model.run("item.expand", { itemId: "lib" });
        await settle();
        view.destroy();
        expect(loads[0]?.signal.aborted).toBe(true);
    });

    it("aborts a load when the app removes the root from its template", async () => {
        const model = filesModel();
        const { loads, loadChildren } = loader();
        const view = await render(Removable, { model, loadChildren });
        model.run("item.expand", { itemId: "lib" });
        await settle();
        expect(loads).toHaveLength(1);
        await view.set("shown", false);
        expect(document.querySelector('[role="tree"]')).toBeNull();
        expect(loads[0]?.signal.aborted).toBe(true);
        // the load the root dropped is the next root's to make
        expect(model.get("children-status-by", { itemId: "lib" })).not.toBe(
            "loading",
        );
    });

    it("reads the latest loadChildren when it loads, without a new engine", async () => {
        const model = filesModel();
        const first = loader();
        const second = loader();
        const view = await renderFiles({
            model,
            loadChildren: first.loadChildren,
        });
        const engine = view.component.root().engine;
        await view.set("loadChildren", second.loadChildren);
        model.run("item.expand", { itemId: "lib" });
        await settle();
        expect(first.loadChildren).not.toHaveBeenCalled();
        expect(second.loadChildren).toHaveBeenCalledTimes(1);
        expect(view.component.root().engine).toBe(engine);
    });
});
