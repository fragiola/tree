// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createSSRApp, defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { useTreeState } from "../src";
import { filesModel, fileTree, Tree } from "./tree";

describe("a server render", () => {
    it("renders the tree, and neither subscribes to the model nor changes it", async () => {
        const model = filesModel();
        const subscribe = vi.spyOn(model, "subscribe");
        const run = vi.spyOn(model, "run");
        const Count = defineComponent({
            setup() {
                const count = useTreeState((state) => state.rootItemIds.length);
                return () => h("output", count.value);
            },
        });
        const html = await renderToString(
            createSSRApp({
                render: () => [
                    fileTree({
                        model,
                        expandedItemIds: [],
                        loadChildren: () => Promise.resolve([]),
                    }),
                ],
            }),
        );
        await renderToString(
            createSSRApp({
                render: () => h(Tree.Root, { model }, () => h(Count)),
            }),
        );
        expect(html).toContain('role="tree"');
        expect(html).toContain('data-tree-path="/0"');
        expect(subscribe).not.toHaveBeenCalled();
        expect(run).not.toHaveBeenCalled();
    });

    it("renders the features' ARIA and data-*: they are model state, no engine needed", async () => {
        const model = filesModel({
            settings: { selectionMode: "multiple" },
            selectedItemIds: ["app"],
        });
        const html = await renderToString(
            createSSRApp({ render: () => [fileTree({ model })] }),
        );
        expect(html).toContain('aria-multiselectable="true"');
        expect(html).toMatch(/aria-selected="true"[^>]*data-selected/);
        expect(html).toContain('aria-selected="false"');
    });
});
