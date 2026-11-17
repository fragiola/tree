// A minimal hand-written DOM for the engine tests (no framework): a root, and for every visible
// item a `treeitem` element with its content row, 20px high, stacked from the root's top. Rows
// get their rects by hand (jsdom has no layout). It re-renders on every revision, as an adapter
// would.
import {
    createTreeEngine,
    type TreeEngine,
    type TreeEngineOptions,
} from "../../src/engine/tree-engine";
import type { TreeModel } from "../../src/state/model";
import type { FileTypes } from "../fixture";

export const ROW = 20;
export const WIDTH = 300;

function setRect(
    element: Element,
    top: number,
    left: number,
    width: number,
    height: number,
) {
    element.getBoundingClientRect = () =>
        ({
            top,
            left,
            width,
            height,
            right: left + width,
            bottom: top + height,
            x: left,
            y: top,
            toJSON: () => ({}),
        }) as DOMRect;
}

export interface Mounted {
    readonly root: HTMLElement;
    readonly engine: TreeEngine<FileTypes>;
    readonly model: TreeModel<FileTypes>;
    item(itemId: string): HTMLElement;
    content(itemId: string): HTMLElement;
    /** presses a key on the tree: `key("ArrowDown")`, `key("a", { ctrlKey: true })` */
    key(
        key: string,
        modifiers?: Partial<
            Record<"shiftKey" | "ctrlKey" | "metaKey" | "altKey", boolean>
        >,
    ): boolean;
    /** the vertical centre of an item's row, and a y at a fraction of its height */
    rowY(itemId: string, fraction?: number): number;
    unmount(): void;
}

export function mount(
    model: TreeModel<FileTypes>,
    options: TreeEngineOptions<FileTypes> = {},
    host: Document = document,
): Mounted {
    const root = host.createElement("div");
    root.setAttribute("role", "tree");
    root.setAttribute("data-tree-part", "root");
    host.body.append(root);
    const engine = createTreeEngine(model, { root, ...options });
    const items = new Map<string, HTMLElement>();
    const contents = new Map<string, HTMLElement>();
    const render = () => {
        const visible = model.get("visible-items");
        setRect(root, 0, 0, WIDTH, Math.max(visible.length * ROW, 100));
        for (const id of [...items.keys()]) {
            if (!visible.some((entry) => entry.itemId === id)) {
                engine.adapter.registerItem(id, null);
                engine.adapter.registerContent(id, null);
                items.get(id)?.remove();
                items.delete(id);
                contents.delete(id);
            }
        }
        visible.forEach((entry, index) => {
            let item = items.get(entry.itemId);
            let content = contents.get(entry.itemId);
            if (!item || !content) {
                item = host.createElement("div");
                item.setAttribute("role", "treeitem");
                item.setAttribute("data-tree-part", "item");
                item.dataset.itemId = entry.itemId;
                content = host.createElement("div");
                content.setAttribute("data-tree-part", "content");
                content.textContent =
                    model.get("item-by", { id: entry.itemId })?.label ?? "";
                item.append(content);
                const id = entry.itemId;
                item.addEventListener("focus", () =>
                    engine.adapter.handleFocus(id),
                );
                content.addEventListener("pointerdown", (event) =>
                    engine.adapter.handlePointerDown(id, event),
                );
                content.addEventListener("click", (event) =>
                    engine.adapter.handleClick(id, event),
                );
                items.set(id, item);
                contents.set(id, content);
                engine.adapter.registerItem(id, item);
                engine.adapter.registerContent(id, content);
            }
            item.tabIndex = model.is("item-tab-stop", { itemId: entry.itemId })
                ? 0
                : -1;
            root.append(item);
            setRect(content, index * ROW, 0, WIDTH, ROW);
        });
    };
    render();
    const unsubscribe = engine.adapter.subscribe(render);
    root.addEventListener("keydown", (event) => {
        engine.adapter.handleKeyDown(event);
    });
    const view = host.defaultView as Window & typeof globalThis;
    return {
        root,
        engine,
        model,
        item: (itemId) => {
            const element = items.get(itemId);
            if (!element) throw new Error(`${itemId} is not rendered`);
            return element;
        },
        content: (itemId) => {
            const element = contents.get(itemId);
            if (!element) throw new Error(`${itemId} is not rendered`);
            return element;
        },
        key: (key, modifiers = {}) => {
            const event = new view.KeyboardEvent("keydown", {
                key,
                bubbles: true,
                cancelable: true,
                ...modifiers,
            });
            const target =
                host.activeElement && root.contains(host.activeElement)
                    ? host.activeElement
                    : root;
            target.dispatchEvent(event);
            return event.defaultPrevented;
        },
        rowY: (itemId, fraction = 0.5) => {
            const index = model
                .get("visible-items")
                .findIndex((entry) => entry.itemId === itemId);
            if (index < 0) throw new Error(`${itemId} is not visible`);
            return index * ROW + fraction * ROW;
        },
        unmount: () => {
            unsubscribe();
            engine.destroy();
            root.remove();
        },
    };
}

/** Dispatches a pointer event (on `target`, or on its document for a move or a release). */
export function pointer(
    target: Element,
    type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
    x: number,
    y: number,
    init: PointerEventInit = {},
): PointerEvent {
    const view = target.ownerDocument.defaultView as Window & typeof globalThis;
    const event = new view.PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
        isPrimary: true,
        button: 0,
        ...init,
    });
    (type === "pointerdown" ? target : target.ownerDocument).dispatchEvent(
        event,
    );
    return event;
}

export const wait = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));
