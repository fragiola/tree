// Parity with @fragiola/tree-react: the same document, rendered by both adapters with every part,
// gives the same elements (part, tag, order) with the same ARIA, `data-*` and structural style.
import { Tree as ReactTree } from "@fragiola/tree-react";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type { TreeJson } from "../src";
import { type FileTypes, files, filesModel, fileTree, render } from "./tree";

type Item = { id: string; label: string; childItemIds?: string[] };

const r = React.createElement;

function reactItem(item: Item): React.ReactElement {
    return r(
        ReactTree.Item,
        { key: item.id, item: item as never },
        r(
            ReactTree.ItemContent,
            null,
            r(ReactTree.Toggle),
            r(ReactTree.Checkbox),
            r("span", null, item.label),
            r(ReactTree.RenameInput, { "aria-label": "Name" }),
        ),
        r(ReactTree.Group, {
            children: (child: Item) => reactItem(child),
        } as never),
    );
}

/** Every element of a tree, as its part, tag, ARIA, `data-*` and style. */
function snapshot(root: Element) {
    return [...root.querySelectorAll("[data-tree-part]")].map((element) => ({
        tag: element.tagName,
        attributes: Object.fromEntries(
            [...element.attributes]
                .filter(
                    ({ name }) =>
                        name.startsWith("aria-") ||
                        name.startsWith("data-") ||
                        ["role", "tabindex", "type", "style"].includes(name),
                )
                .map(({ name, value }) => [
                    name,
                    name === "style" ? value.replace(/\s|;$/g, "") : value,
                ]),
        ),
    }));
}

async function both(
    json: TreeJson<FileTypes>,
    props: Record<string, unknown> = {},
) {
    await render(() => fileTree({ model: filesModel(json), ...props }));
    const vue = snapshot(document.querySelector('[role="tree"]') as Element);
    document.body.innerHTML = "";
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    (
        globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const model = filesModel(json);
    await act(async () => {
        root.render(
            r(
                ReactTree.Root,
                { model: model as never, "aria-label": "Files", ...props },
                r(ReactTree.Items, {
                    children: (item: Item) => reactItem(item),
                } as never),
                r(ReactTree.DropIndicator),
                r(ReactTree.LiveRegion),
            ),
        );
    });
    const react = snapshot(host.firstElementChild as Element);
    act(() => root.unmount());
    return { vue, react };
}

describe("parity with @fragiola/tree-react", () => {
    it("renders the same elements and attributes for the same document", async () => {
        const json = files({
            expandedItemIds: ["src", "utils"],
            selectedItemIds: ["a"],
            checkedItemIds: ["a"],
            focusedItemId: "app",
            settings: { selectionMode: "multiple" },
        });
        const app = json.items.app;
        if (app) json.items.app = { ...app, disabled: true };
        const { vue, react } = await both(json, { checkboxes: true });
        expect(vue.length).toBeGreaterThan(20);
        expect(vue).toEqual(react);
    });

    it("renders the same without checkboxes and with no selection", async () => {
        const { vue, react } = await both(
            files({ settings: { selectionMode: "none" } }),
        );
        expect(vue).toEqual(react);
    });

    it("renders the same rename input", async () => {
        const json = files({ renamingItemId: "readme" });
        const { vue, react } = await both(json);
        expect(
            vue.find(
                (part) => part.attributes["data-tree-part"] === "rename-input",
            ),
        ).toBeDefined();
        expect(vue).toEqual(react);
    });
});
