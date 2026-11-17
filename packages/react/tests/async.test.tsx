import { act, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import { createTreeRef, type TreeItemJson } from "../src";
import {
    type FEATURES,
    FileTree,
    type FileTypes,
    filesModel,
    itemElement,
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

describe("async children", () => {
    it("loads an unloaded item when it is expanded, then renders its children", async () => {
        const model = filesModel();
        const { loads, loadChildren } = loader();
        render(<FileTree model={model} loadChildren={loadChildren} />);
        act(() => {
            model.run("item.expand", { itemId: "lib" });
        });
        expect(loadChildren).toHaveBeenCalledTimes(1);
        expect(itemElement("lib")).toHaveAttribute("data-loading", "");
        await act(async () =>
            loads[0]?.resolve([
                { id: "x", kind: "file", label: "x.ts", data: { size: 1 } },
            ]),
        );
        expect(itemElement("x.ts")).toHaveAttribute("aria-level", "3");
        expect(itemElement("lib")).not.toHaveAttribute("data-loading");
    });

    it("loads an item expanded in the document once mounted, once under StrictMode", async () => {
        const model = filesModel({ expandedItemIds: ["src", "lib"] });
        const { loads, loadChildren } = loader();
        render(
            <StrictMode>
                <FileTree model={model} loadChildren={loadChildren} />
            </StrictMode>,
        );
        // StrictMode's first engine was destroyed: its load was aborted, the live one loads
        const live = loads.filter((load) => !load.signal.aborted);
        expect(live).toHaveLength(1);
        await act(async () => live[0]?.resolve([]));
        expect(model.get("children-status-by", { itemId: "lib" })).toBe(
            "loaded",
        );
    });

    it("marks a failed load, announces it, and retries through the engine", async () => {
        const model = filesModel();
        const { loads, loadChildren } = loader();
        const tree = createTreeRef<FileTypes, typeof FEATURES>();
        render(
            <FileTree
                model={model}
                loadChildren={loadChildren}
                announce={(event) =>
                    event.type === "load-error"
                        ? `Could not load ${event.itemId}`
                        : undefined
                }
                treeRef={tree}
            />,
        );
        act(() => {
            model.run("item.expand", { itemId: "lib" });
        });
        await act(async () => loads[0]?.reject(new Error("offline")));
        expect(itemElement("lib")).toHaveAttribute("data-load-error", "");
        expect(screen.getByRole("status")).toHaveTextContent(
            "Could not load lib",
        );
        act(() => {
            tree.current?.engine.run("load-children", { itemId: "lib" });
        });
        expect(loadChildren).toHaveBeenCalledTimes(2);
        expect(itemElement("lib")).toHaveAttribute("data-loading", "");
    });

    it("aborts a load when the tree unmounts", () => {
        const model = filesModel();
        const { loads, loadChildren } = loader();
        const { unmount } = render(
            <FileTree model={model} loadChildren={loadChildren} />,
        );
        act(() => {
            model.run("item.expand", { itemId: "lib" });
        });
        unmount();
        expect(loads[0]?.signal.aborted).toBe(true);
    });
});
