import { afterEach, describe, expect, it, vi } from "vitest";
import { h, nextTick, ref } from "vue";
import { createTreeModel, Tree } from "../src";
import { selection } from "../src/selection";
import { virtualization } from "../src/virtualization";
import { files, fileTree, itemElement, render, settle } from "./tree";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("features on the root", () => {
    it("a bare tree says nothing about a selection", async () => {
        await render(() =>
            h(Tree.Root, {
                model: createTreeModel(files()) as never,
                "aria-label": "Bare",
            }),
        );
        const tree = document.querySelector('[role="tree"]');
        expect(tree).not.toHaveAttribute("aria-multiselectable");
        expect(document.querySelector("[aria-selected]")).toBeNull();
    });

    it("an item gets its features' ARIA, and every part of it their data-*", async () => {
        await render(() =>
            fileTree({
                defaultTree: files({
                    settings: { selectionMode: "multiple" },
                    selectedItemIds: ["app"],
                }),
            }),
        );
        expect(document.querySelector('[role="tree"]')).toHaveAttribute(
            "aria-multiselectable",
            "true",
        );
        const app = itemElement("app.ts");
        expect(app).toHaveAttribute("aria-selected", "true");
        expect(app).toHaveAttribute("data-selected", "");
        const content = app.querySelector('[data-tree-part="content"]');
        expect(content).toHaveAttribute("data-selected", "");
        expect(content).not.toHaveAttribute("aria-selected");
    });

    it("warns once, and ignores it, when a feature's list has no feature", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const model = createTreeModel(files());
        await render(() =>
            h(Tree.Root, {
                model,
                "aria-label": "Files",
                selectedItemIds: ["app"],
            } as never),
        );
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]?.[0]).toContain(
            "selectedItemIds needs the selection feature",
        );
        expect("selectedItemIds" in model.state).toBe(false);
    });

    it("warns once when the features prop changes after the root created its model", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const features = ref([selection()]);
        await render(() =>
            fileTree({
                defaultTree: files(),
                features: features.value as never,
            }),
        );
        // an equal new list (inline `:features="[selection()]"`) is the same: no warning
        features.value = [selection({ mode: "multiple" })];
        await nextTick();
        await settle();
        expect(warn).not.toHaveBeenCalled();
        features.value = [selection(), virtualization()] as never;
        await settle();
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]?.[0]).toContain(
            "the features prop changed after the root created its model",
        );
    });
});
