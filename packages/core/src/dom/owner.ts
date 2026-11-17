// The DOM the engine reaches, always through the root element: its document and window (an
// iframe's own, never the global ones), the timers and frames of that window, and the parts'
// attributes.

/** The attribute every part's element carries: its part name (`root`, `item`, `content`, …). */
export const PART_ATTRIBUTE = "data-tree-part";

/** The attribute an item's element carries: its path from the root (`/0/2`). */
export const PATH_ATTRIBUTE = "data-tree-path";

/** A subtree of an item's content that never starts a drag (a slider, a menu button). */
export const NO_DRAG_ATTRIBUTE = "data-tree-no-drag";

/**
 * What never starts a drag (nor a selection) when pressed inside an item's content: native
 * controls, links, editable text, the toggle and checkbox parts, and the subtrees that opt out.
 */
export const DRAG_EXEMPT = [
    "input",
    "textarea",
    "select",
    "option",
    "button",
    "a[href]",
    '[contenteditable]:not([contenteditable="false"])',
    `[${PART_ATTRIBUTE}="toggle"]`,
    `[${PART_ATTRIBUTE}="checkbox"]`,
    `[${PART_ATTRIBUTE}="rename-input"]`,
    `[${NO_DRAG_ATTRIBUTE}]`,
].join(", ");

/** The window an element lives in (its document's), if any. */
export function windowOf(
    element: Element | null | undefined,
): Window | undefined {
    return element?.ownerDocument?.defaultView ?? undefined;
}

/** Whether a press on `target` (inside `container`) must not start a drag. */
export function isDragExempt(
    target: EventTarget | null,
    container: Element,
): boolean {
    const element = asElement(target);
    if (!element) return false;
    const exempt = element.closest(DRAG_EXEMPT);
    return (
        exempt !== null && container.contains(exempt) && exempt !== container
    );
}

/** An event target as an element (a text node's parent), if it is one. */
export function asElement(target: EventTarget | null): Element | undefined {
    if (target === null || typeof target !== "object") return undefined;
    const node = target as Node;
    if (node.nodeType === 1) return node as Element;
    return node.parentElement ?? undefined;
}

/** A timer and frame scheduler on one window. */
export interface Scheduler {
    setTimeout(callback: () => void, ms: number): () => void;
    requestFrame(callback: () => void): () => void;
}

/** The scheduler of an element's window; nothing runs without one. */
export function schedulerOf(element: Element | null | undefined): Scheduler {
    const view = windowOf(element);
    return {
        setTimeout(callback, ms) {
            if (!view) return () => {};
            const id = view.setTimeout(callback, ms);
            return () => view.clearTimeout(id);
        },
        requestFrame(callback) {
            if (!view) return () => {};
            if (typeof view.requestAnimationFrame !== "function") {
                const id = view.setTimeout(callback, 16);
                return () => view.clearTimeout(id);
            }
            const id = view.requestAnimationFrame(callback);
            return () => view.cancelAnimationFrame(id);
        },
    };
}

/** The writing direction of an element, from its computed style (`ltr` without a window). */
export function directionOf(
    element: Element | null | undefined,
): "ltr" | "rtl" {
    const view = windowOf(element);
    if (!element || !view) return "ltr";
    const dir = element.closest("[dir]")?.getAttribute("dir")?.toLowerCase();
    const computed = view.getComputedStyle(element).direction;
    if (computed === "rtl" || computed === "ltr") {
        // jsdom computes no direction from `dir`: the attribute decides when the style says ltr
        return computed === "ltr" && dir === "rtl" ? "rtl" : computed;
    }
    return dir === "rtl" ? "rtl" : "ltr";
}
