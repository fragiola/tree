// A hand-written virtualized tree for the engine tests (no framework): the root is the scroll
// element, `viewport` px high, and renders only the engine's window (`get("virtual-window")`), as
// an adapter's `Tree.VirtualItems` would: flat rows, each placed at its offset less the scroll.
// jsdom has no layout, so the scroll, the sizes and the rects are kept by hand.
import {
    createTreeEngine,
    type TreeEngine,
    type TreeEngineOptions,
} from "../../src/engine/tree-engine";
import { featuresOf } from "../../src/features/registry";
import {
    type SelectionFeature,
    selection,
} from "../../src/selection/selection";
import type { TreeJson } from "../../src/state/json";
import { createTreeModel, type TreeModel } from "../../src/state/model";
import {
    type VirtualizationFeature,
    virtualization,
} from "../../src/virtual/virtualization";
import type { TreeVirtualizerOptions } from "../../src/virtual/virtualizer";
import type { FileTypes } from "../fixture";

/** The features of a virtualized test tree. */
export type VirtualFeatures = readonly [
    SelectionFeature,
    VirtualizationFeature,
];

export const WIDTH = 300;

function rect(top: number, left: number, width: number, height: number) {
    return {
        top,
        left,
        width,
        height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
        toJSON: () => ({}),
    } as DOMRect;
}

/** `count` root files (`n0`, `n1`, …) labelled `item 0`, `item 1`, … unless `label` says otherwise. */
export function flatModel(
    count: number,
    label: (index: number) => string = (index) => `item ${index}`,
): TreeModel<FileTypes, readonly [SelectionFeature]> {
    const items: TreeJson<FileTypes>["items"] = {};
    const rootItemIds: string[] = [];
    for (let i = 0; i < count; i++) {
        rootItemIds.push(`n${i}`);
        items[`n${i}`] = { kind: "file", label: label(i), data: { size: i } };
    }
    return createTreeModel<FileTypes, readonly [SelectionFeature]>(
        { version: 1, rootItemIds, items, expandedItemIds: [] },
        { features: [selection()] },
    );
}

export interface VirtualMounted {
    readonly root: HTMLElement;
    readonly engine: TreeEngine<FileTypes, VirtualFeatures>;
    readonly model: TreeModel<FileTypes, VirtualFeatures>;
    /** the item's element, when rendered */
    item(itemId: string): HTMLElement | undefined;
    content(itemId: string): HTMLElement | undefined;
    /** the rendered items, in DOM order */
    rendered(): string[];
    /** scrolls the root and fires its scroll event */
    scroll(top: number): void;
    key(key: string): boolean;
    unmount(): void;
}

/**
 * Mounts a virtualized tree of `source`'s document: a new model with the selection and the
 * virtualization features (`mounted.model`).
 */
export function mountVirtual(
    source: TreeModel<FileTypes>,
    virtual: TreeVirtualizerOptions,
    {
        viewport = 200,
        ...options
    }: TreeEngineOptions<FileTypes> & {
        viewport?: number;
    } = {},
): VirtualMounted {
    const root = document.createElement("div");
    root.setAttribute("role", "tree");
    root.setAttribute("data-tree-part", "root");
    root.style.overflowY = "auto";
    let scrollTop = 0;
    const installed = featuresOf(source).list.some(
        (feature) => feature.name === "selection",
    );
    const model = createTreeModel<FileTypes, VirtualFeatures>(
        source.get("tree-json"),
        {
            features: (installed
                ? [selection(), virtualization(virtual)]
                : [virtualization(virtual)]) as unknown as VirtualFeatures,
        },
    );
    let engine: TreeEngine<FileTypes, VirtualFeatures> | undefined;
    Object.defineProperty(root, "scrollTop", {
        configurable: true,
        get: () => scrollTop,
        set: (value: number) => {
            const total = engine?.get("virtual-window")?.totalSize ?? 0;
            const next = Math.max(0, Math.min(value, total - viewport));
            if (next === scrollTop) return;
            scrollTop = next;
            // a browser fires the scroll event after the scroll
            queueMicrotask(() => root.dispatchEvent(new Event("scroll")));
        },
    });
    Object.defineProperty(root, "clientHeight", { get: () => viewport });
    root.getBoundingClientRect = () => rect(0, 0, WIDTH, viewport);
    document.body.append(root);
    engine = createTreeEngine(model, { root, ...options });
    const mounted = engine;
    const items = new Map<string, HTMLElement>();
    const contents = new Map<string, HTMLElement>();
    const offsets = new Map<string, { offset: number; size: number }>();
    const render = () => {
        const window = mounted.get("virtual-window");
        if (!window) throw new Error("not virtualized");
        const ids = new Set(window.rows.map((row) => row.itemId));
        for (const id of [...items.keys()]) {
            if (ids.has(id)) continue;
            mounted.adapter.registerItem(id, null);
            mounted.adapter.registerContent(id, null);
            items.get(id)?.remove();
            items.delete(id);
            contents.delete(id);
        }
        for (const row of window.rows) {
            const id = row.itemId;
            offsets.set(id, { offset: row.offset, size: row.size });
            let item = items.get(id);
            if (!item) {
                item = document.createElement("div");
                item.setAttribute("role", "treeitem");
                item.setAttribute("data-tree-part", "item");
                item.setAttribute("aria-level", String(row.level));
                const content = document.createElement("div");
                content.setAttribute("data-tree-part", "content");
                content.getBoundingClientRect = () => {
                    const box = offsets.get(id) ?? { offset: 0, size: 0 };
                    return rect(box.offset - scrollTop, 0, WIDTH, box.size);
                };
                item.append(content);
                item.addEventListener("focus", () =>
                    mounted.adapter.handleFocus(id),
                );
                content.addEventListener("pointerdown", (event) =>
                    mounted.adapter.handlePointerDown(id, event),
                );
                items.set(id, item);
                contents.set(id, content);
                mounted.adapter.registerItem(id, item);
                mounted.adapter.registerContent(id, content);
            }
            item.tabIndex = model.is("item-tab-stop", { itemId: id }) ? 0 : -1;
            // moved only when out of place, as a keyed framework does (a move would blur it)
            const at = window.rows.indexOf(row);
            if (root.children[at] !== item) {
                root.insertBefore(item, root.children[at] ?? null);
            }
        }
    };
    render();
    const unsubscribe = mounted.adapter.subscribe(render);
    for (const type of ["dragenter", "dragover", "dragleave", "drop"])
        root.addEventListener(type, (event) =>
            mounted.adapter.handleDragEvent(event as DragEvent),
        );
    root.addEventListener("keydown", (event) => {
        mounted.adapter.handleKeyDown(event);
    });
    return {
        root,
        engine: mounted,
        model,
        item: (itemId) => items.get(itemId),
        content: (itemId) => contents.get(itemId),
        rendered: () =>
            [...root.children].map(
                (child) =>
                    [...items].find(([, element]) => element === child)?.[0] ??
                    "?",
            ),
        scroll: (top) => {
            scrollTop = top;
            root.dispatchEvent(new Event("scroll"));
        },
        key: (key) => {
            const event = new KeyboardEvent("keydown", {
                key,
                bubbles: true,
                cancelable: true,
            });
            const active = document.activeElement;
            (active && root.contains(active) ? active : root).dispatchEvent(
                event,
            );
            return event.defaultPrevented;
        },
        unmount: () => {
            unsubscribe();
            mounted.destroy();
            root.remove();
        },
    };
}
