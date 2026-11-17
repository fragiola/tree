// The virtualizer: an opt-in part of the engine that renders a window of the visible items instead
// of all of them. `createTreeVirtualizer(options)` describes it; the engine connects it when its
// `virtual` option holds one, so a tree without it never reaches this file (and a bundle that
// never imports `createTreeVirtualizer` leaves it out). Like Data Grid's (fragiola/data-grid,
// packages/core/src/viewport), it is the core's own: no library.
//
// A virtualized tree is flat: the rendered rows are siblings in `role="tree"`, each with its
// `aria-level`, `aria-posinset` and `aria-setsize` (the WAI-ARIA tree pattern allows it), with
// spacers where rows are not rendered. The window is the rows in view plus `overscan` on each side,
// and the rows that must stay in the DOM wherever the scroll is (the roving tab stop, the item
// being renamed, the item a pointer pressed): they are pinned at their own offsets.
//
// Every DOM access goes through the root's document and window: the scroll element's `scroll`
// event, its window's `ResizeObserver` (the viewport's size, and the rows' sizes when they are
// estimated), never the global ones.
import { windowOf } from "../dom/owner";
import type { VisibleItem } from "../state/types";
import { type ScrollAlign, scrollTargetForSpan } from "./scroll-target";
import { cleanSize, FixedSizes, type RowSizes, VariableSizes } from "./sizes";
import {
    type AxisWindow,
    EMPTY_WINDOW,
    type Range,
    sameRange,
    windowFor,
} from "./window";

export type { ScrollAlign } from "./scroll-target";

/** A row's size in pixels: one for all, or one per row. */
export type RowSize = number | ((row: VisibleItem) => number);

/** Options of {@link createTreeVirtualizer}. */
export interface TreeVirtualizerOptions {
    /**
     * every row's exact size (px), or one per row: rows are never measured (the fastest; your CSS
     * must give the rows these sizes). Leave it out to measure the rows instead
     */
    rowSize?: RowSize | undefined;
    /**
     * the size (px) a row is given until it is measured (default 32), or one per row: rendered rows
     * are measured through the root window's `ResizeObserver`, and keep their size while they stay
     * visible items. Ignored with `rowSize`
     */
    estimateRowSize?: RowSize | undefined;
    /** how many rows are rendered past each edge of the view (default 8) */
    overscan?: number | undefined;
    /**
     * the element that scrolls the rows: the root itself, or one of its ancestors (default: the
     * nearest scrolling ancestor of the root, the root included, else the document)
     */
    scrollElement?: (() => HTMLElement | null | undefined) | undefined;
    /**
     * the view's size (px) while the scroll element has none: a server render, a test without
     * layout, a hidden tree (default 0: no rows until the view has a size)
     */
    initialViewportSize?: number | undefined;
}

/** A rendered row: a visible item, its index among them, and where it is. */
export interface VirtualRow extends VisibleItem {
    /** its index in `model.get("visible-items")` */
    readonly index: number;
    /** from the top of the rows to the row's top (px) */
    readonly offset: number;
    /** its size (px): measured, given, or estimated */
    readonly size: number;
    /** the space (px) between the previous rendered row (or the top) and this row: a spacer's size */
    readonly spaceBefore: number;
}

/** What a virtualized tree renders: `engine.get("virtual-window")`. */
export interface VirtualWindow {
    /** the rows to render, in order, each with the spacer to put before it */
    readonly rows: readonly VirtualRow[];
    /** the rows in view plus the overscan: from `start` (included) to `end` (excluded) */
    readonly start: number;
    readonly end: number;
    /** the size (px) of all the visible items together */
    readonly totalSize: number;
    /** the space (px) after the last rendered row: the last spacer's size */
    readonly spaceAfter: number;
}

/** What the virtualizer reads of its engine. */
export interface VirtualHost {
    /** the root element, once attached */
    root(): HTMLElement | undefined;
    /** the visible items, in render order (the model's) */
    visible(): readonly VisibleItem[];
    /** each visible item's index */
    visibleIndex(): ReadonlyMap<string, number>;
    /** an item's registered content element (its row) */
    contentOf(itemId: string): HTMLElement | undefined;
    /** the items whose rows stay rendered wherever the scroll is */
    pinnedItemIds(): readonly (string | null | undefined)[];
    /** the window changed: the adapters render it again */
    changed(): void;
}

/** One engine's virtualizer: what the engine calls. */
export interface VirtualController {
    /** the window to render */
    currentWindow(): VirtualWindow;
    /** the root was attached: find the scroll element and follow it */
    attach(root: HTMLElement): void;
    /** the root was detached: stop following anything */
    detach(): void;
    /** an item's element was registered (or unregistered, `null`): measure it */
    observe(itemId: string, element: HTMLElement | null): void;
    /** scrolls a visible item's row into view; false when the item is not visible */
    reveal(itemId: string, align?: ScrollAlign): boolean;
    /** the rows rendered around the view (the pinned rows aside) */
    rendered(): Range;
    /**
     * a row that is not rendered: its box relative to the root (its scroll included), placed from
     * a rendered row's by their offsets (a keyboard drag's line below a long subtree)
     */
    unrenderedRowBox(
        itemId: string,
    ): { top: number; height: number } | undefined;
    /** the element that scrolls the rows (undefined when it is the document) */
    scrollElement(): HTMLElement | undefined;
    /** how many rows a page key moves: the rows in view less one, at least one */
    pageRows(): number;
    destroy(): void;
}

/**
 * A virtualizer, for the engine's `virtual` option: `createTreeEngine(model, { virtual })`, or
 * the `virtual` prop of a root. It holds options only, so one serves every tree that uses it:
 * create it once (at module level, or memoized), not on every render.
 */
export interface TreeVirtualizer {
    readonly options: Readonly<TreeVirtualizerOptions>;
    /** called by the engine: this virtualizer's state for one engine */
    connect(host: VirtualHost): VirtualController;
}

/**
 * Describes a virtualizer: the engine renders only the visible items in view (plus `overscan`),
 * so a tree of hundreds of thousands of visible items scrolls, navigates and drags like a small
 * one. Render its window with `Tree.VirtualItems` (or `engine.get("virtual-window")`).
 *
 * ```ts
 * const virtual = createTreeVirtualizer({ rowSize: 28 });
 * const engine = createTreeEngine(model, { root, virtual });
 * ```
 */
export function createTreeVirtualizer(
    options: TreeVirtualizerOptions = {},
): TreeVirtualizer {
    const frozen = Object.freeze({ ...options });
    return Object.freeze({
        options: frozen,
        connect: (host: VirtualHost) => new Virtualizer(host, frozen),
    });
}

const DEFAULT_ESTIMATE = 32;
const DEFAULT_OVERSCAN = 8;

interface Observer {
    observe(target: Element): void;
    unobserve(target: Element): void;
    disconnect(): void;
}

class Virtualizer implements VirtualController {
    private readonly measuring: boolean;
    private readonly overscan: number;
    private sizes: RowSizes = new FixedSizes(0, 0);
    /** the visible items the sizes are of */
    private list: readonly VisibleItem[] | undefined;
    /** the sizes measured, by item: a row keeps its size while it stays a visible item */
    private readonly measured = new Map<string, number>();
    private axis: AxisWindow = EMPTY_WINDOW;
    /** changes whenever the sizes or the window do: the rows are built again */
    private stamp = 0;
    private built:
        | { stamp: number; pinned: string; value: VirtualWindow }
        | undefined;
    /** the view: its offset from the top of the rows, its size */
    private offset = 0;
    private viewport: number;
    /** from the scroll element's scroll origin to the top of the rows */
    private start = 0;
    /** the root's padding and border above its content (read on a resize) */
    private inset = 0;
    private rootElement: HTMLElement | undefined;
    private scroller: HTMLElement | undefined;
    /** the scroll element is the document's: the window's scroll and size */
    private documentScroll = false;
    private overflowAnchor: string | undefined;
    /**
     * the row the last reveal scrolled to: it is revealed again when rows are measured (their
     * estimates put it elsewhere), until a scroll the engine did not make
     */
    private revealing: { itemId: string; align: ScrollAlign } | undefined;
    /** the scroll offset the engine wrote last: a scroll event elsewhere is the user's */
    private written: number | undefined;
    private release: (() => void)[] = [];
    private viewObserver: Observer | undefined;
    private rowObserver: Observer | undefined;
    private readonly elements = new Map<string, HTMLElement>();
    private readonly ids = new WeakMap<Element, string>();

    constructor(
        private readonly host: VirtualHost,
        private readonly options: Readonly<TreeVirtualizerOptions>,
    ) {
        this.measuring = options.rowSize === undefined;
        this.overscan = Math.max(
            0,
            Math.floor(options.overscan ?? DEFAULT_OVERSCAN),
        );
        this.viewport = cleanSize(options.initialViewportSize ?? 0);
    }

    // ---------------------------------------------------------------------------------------------
    // the window
    // ---------------------------------------------------------------------------------------------

    currentWindow(): VirtualWindow {
        this.sync();
        const { start, end } = this.axis.rendered;
        const index = this.host.visibleIndex();
        const pinned: number[] = [];
        for (const itemId of this.host.pinnedItemIds()) {
            const at = itemId == null ? undefined : index.get(itemId);
            if (at !== undefined && (at < start || at >= end)) pinned.push(at);
        }
        pinned.sort((a, b) => a - b);
        const pinnedKey = pinned.join(",");
        const built = this.built;
        if (built && built.stamp === this.stamp && built.pinned === pinnedKey) {
            return built.value;
        }
        const visible = this.list ?? [];
        const rows: VirtualRow[] = [];
        let last = 0;
        const push = (at: number) => {
            const item = visible[at];
            if (!item) return;
            const offset = this.sizes.offsetOf(at);
            const size = this.sizes.sizeOf(at);
            rows.push(
                Object.freeze({
                    itemId: item.itemId,
                    parentItemId: item.parentItemId,
                    level: item.level,
                    posinset: item.posinset,
                    setsize: item.setsize,
                    index: at,
                    offset,
                    size,
                    spaceBefore: Math.max(0, offset - last),
                }),
            );
            last = offset + size;
        };
        let p = 0;
        for (; p < pinned.length && (pinned[p] ?? 0) < start; p++) {
            if (pinned[p] !== pinned[p - 1]) push(pinned[p] ?? 0);
        }
        for (let at = start; at < end; at++) push(at);
        for (; p < pinned.length; p++) {
            if (pinned[p] !== pinned[p - 1]) push(pinned[p] ?? 0);
        }
        const totalSize = this.sizes.totalSize;
        const value: VirtualWindow = Object.freeze({
            rows: Object.freeze(rows),
            start,
            end,
            totalSize,
            spaceAfter: Math.max(0, totalSize - last),
        });
        this.built = { stamp: this.stamp, pinned: pinnedKey, value };
        return value;
    }

    rendered(): Range {
        this.sync();
        return this.axis.rendered;
    }

    unrenderedRowBox(
        itemId: string,
    ): { top: number; height: number } | undefined {
        this.sync();
        const root = this.host.root();
        const at = this.host.visibleIndex().get(itemId);
        if (!root || at === undefined) return undefined;
        const { start, end } = this.axis.rendered;
        const visible = this.list ?? [];
        for (let i = start; i < end; i++) {
            const entry = visible[i];
            const content = entry && this.host.contentOf(entry.itemId);
            if (!content) continue;
            const top =
                content.getBoundingClientRect().top -
                root.getBoundingClientRect().top +
                root.scrollTop;
            return {
                top: top + this.sizes.offsetOf(at) - this.sizes.offsetOf(i),
                height: this.sizes.sizeOf(at),
            };
        }
        return undefined;
    }

    pageRows(): number {
        this.sync();
        const { start, end } = this.axis.visible;
        return Math.max(1, end - start - 1);
    }

    scrollElement(): HTMLElement | undefined {
        return this.documentScroll ? undefined : this.scroller;
    }

    /** Builds the sizes again when the visible items changed (a model change), and the window. */
    private sync(): void {
        const visible = this.host.visible();
        if (visible === this.list) return;
        this.list = visible;
        this.sizes = this.sizesOf(visible);
        this.stamp += 1;
        this.axis = windowFor(
            this.sizes,
            this.offset,
            this.viewport,
            this.overscan,
            this.axis,
        );
    }

    private sizesOf(visible: readonly VisibleItem[]): RowSizes {
        const { rowSize, estimateRowSize } = this.options;
        if (typeof rowSize === "number") {
            return new FixedSizes(visible.length, cleanSize(rowSize));
        }
        const estimate = rowSize ?? estimateRowSize ?? DEFAULT_ESTIMATE;
        if (typeof estimate === "number" && this.measured.size === 0) {
            // nothing measured yet: every row the same size, until one is
            return this.measuring
                ? new VariableSizes(
                      new Float64Array(visible.length).fill(
                          cleanSize(estimate),
                      ),
                  )
                : new FixedSizes(visible.length, cleanSize(estimate));
        }
        const sizes = new Float64Array(visible.length);
        const { measured } = this;
        for (let i = 0; i < visible.length; i++) {
            const item = visible[i] as VisibleItem;
            sizes[i] =
                measured.get(item.itemId) ??
                (typeof estimate === "number" ? estimate : estimate(item));
        }
        // the sizes of items no longer visible are dropped once they outnumber the visible ones
        if (measured.size > 2 * visible.length + 1024) {
            const index = this.host.visibleIndex();
            for (const itemId of measured.keys()) {
                if (!index.has(itemId)) measured.delete(itemId);
            }
        }
        return new VariableSizes(sizes);
    }

    /** The window at the current view; the adapters render again when it changed. */
    private update(scrolled: boolean, sizesChanged = false): void {
        this.sync();
        const next = windowFor(
            this.sizes,
            this.offset,
            this.viewport,
            this.overscan,
            this.axis,
            scrolled,
        );
        if (next === this.axis && !sizesChanged) return;
        const same = sameRange(next.rendered, this.axis.rendered);
        this.axis = next;
        // the view moved inside the overscan: nothing to render again
        if (same && !sizesChanged) return;
        this.stamp += 1;
        this.host.changed();
    }

    // ---------------------------------------------------------------------------------------------
    // the scroll element
    // ---------------------------------------------------------------------------------------------

    attach(root: HTMLElement): void {
        this.detach();
        const view = windowOf(root) as (Window & typeof globalThis) | undefined;
        if (!view) return;
        this.rootElement = root;
        const given = this.options.scrollElement?.() ?? undefined;
        const scroller = given ?? scrollingAncestor(root, view);
        this.documentScroll = scroller === undefined;
        const element =
            scroller ?? root.ownerDocument.scrollingElement ?? undefined;
        if (!(element instanceof view.HTMLElement)) return;
        this.scroller = element;
        const target: EventTarget = this.documentScroll ? view : element;
        const onScroll = () => {
            if (
                this.revealing &&
                (this.written === undefined ||
                    Math.abs(element.scrollTop - this.written) > 1)
            ) {
                this.revealing = undefined;
            }
            this.read(false);
            this.update(true);
        };
        target.addEventListener("scroll", onScroll, { passive: true });
        this.release.push(() => target.removeEventListener("scroll", onScroll));
        const onResize = () => {
            this.read(true);
            this.update(false);
        };
        if (!this.documentScroll && typeof view.ResizeObserver === "function") {
            const observer = new view.ResizeObserver(onResize);
            observer.observe(element);
            if (element !== root) observer.observe(root);
            this.viewObserver = observer;
        } else {
            view.addEventListener("resize", onResize);
            this.release.push(() =>
                view.removeEventListener("resize", onResize),
            );
        }
        if (this.measuring) {
            // the engine keeps the view in place when rows above it are measured; the browser's
            // own scroll anchoring would move it a second time
            this.overflowAnchor = element.style.overflowAnchor;
            element.style.overflowAnchor = "none";
            if (typeof view.ResizeObserver === "function") {
                this.rowObserver = new view.ResizeObserver((entries) =>
                    this.measure(entries),
                );
                for (const registered of this.elements.values()) {
                    this.rowObserver.observe(registered);
                }
            }
        }
        this.read(true);
        this.update(false);
    }

    detach(): void {
        for (const release of this.release.splice(0)) release();
        this.viewObserver?.disconnect();
        this.rowObserver?.disconnect();
        this.viewObserver = undefined;
        this.rowObserver = undefined;
        if (this.scroller && this.overflowAnchor !== undefined) {
            this.scroller.style.overflowAnchor = this.overflowAnchor;
        }
        this.overflowAnchor = undefined;
        this.scroller = undefined;
        this.rootElement = undefined;
    }

    destroy(): void {
        this.detach();
        this.elements.clear();
    }

    /** Reads the view from the DOM: the scroll offset, the start of the rows, the view's size. */
    private read(resized: boolean): void {
        const root = this.rootElement;
        const element = this.scroller;
        const view = windowOf(root);
        if (!root || !element || !view) return;
        if (resized) {
            const style = view.getComputedStyle(root);
            this.inset =
                root.clientTop + (Number.parseFloat(style.paddingTop) || 0);
        }
        let scrollTop: number;
        let size: number;
        if (this.documentScroll) {
            scrollTop = element.scrollTop;
            size = view.innerHeight;
            this.start =
                root.getBoundingClientRect().top + scrollTop + this.inset;
        } else {
            scrollTop = element.scrollTop;
            size = element.clientHeight;
            this.start =
                element === root
                    ? this.inset
                    : root.getBoundingClientRect().top -
                      element.getBoundingClientRect().top -
                      element.clientTop +
                      scrollTop +
                      this.inset;
        }
        this.viewport =
            size > 0 ? size : cleanSize(this.options.initialViewportSize ?? 0);
        this.offset = Math.max(0, scrollTop - this.start);
    }

    /** Scrolls the scroll element so the view starts `offset` below the top of the rows. */
    private scrollTo(offset: number): void {
        this.offset = Math.max(0, offset);
        const element = this.scroller;
        if (!element) return;
        element.scrollTop = this.offset + this.start;
        this.written = element.scrollTop;
    }

    reveal(itemId: string, align: ScrollAlign = "nearest"): boolean {
        this.revealing = { itemId, align };
        return this.revealNow(itemId, align);
    }

    private revealNow(itemId: string, align: ScrollAlign): boolean {
        this.sync();
        const index = this.host.visibleIndex().get(itemId);
        if (index === undefined) {
            this.revealing = undefined;
            return false;
        }
        const start = this.sizes.offsetOf(index);
        const target = scrollTargetForSpan(
            start,
            start + this.sizes.sizeOf(index),
            this.offset,
            this.viewport,
            this.sizes.totalSize,
            align,
        );
        if (target !== this.offset) {
            this.scrollTo(target);
            this.update(false);
        }
        return true;
    }

    // ---------------------------------------------------------------------------------------------
    // measured rows
    // ---------------------------------------------------------------------------------------------

    observe(itemId: string, element: HTMLElement | null): void {
        if (!this.measuring) return;
        const previous = this.elements.get(itemId);
        if (previous === element) return;
        if (previous) {
            this.rowObserver?.unobserve(previous);
            this.ids.delete(previous);
            this.elements.delete(itemId);
        }
        if (!element) return;
        this.elements.set(itemId, element);
        this.ids.set(element, itemId);
        this.rowObserver?.observe(element);
    }

    /** Rows were measured: their sizes replace the estimates, and the view stays where it was. */
    private measure(entries: readonly ResizeObserverEntry[]): void {
        this.sync();
        const sizes = this.sizes;
        if (!(sizes instanceof VariableSizes)) return;
        const index = this.host.visibleIndex();
        let changed = false;
        let anchor = 0;
        for (const entry of entries) {
            const itemId = this.ids.get(entry.target);
            const at = itemId === undefined ? undefined : index.get(itemId);
            if (itemId === undefined || at === undefined) continue;
            const size =
                entry.borderBoxSize?.[0]?.blockSize ??
                entry.target.getBoundingClientRect().height;
            // a hidden row (0) keeps the size it had
            if (!(size > 0)) continue;
            this.measured.set(itemId, size);
            const top = sizes.offsetOf(at);
            const grew = sizes.set(at, size);
            if (grew === 0) continue;
            changed = true;
            // a row above the view: what is in view moves by as much, unless the view follows
            if (top < this.offset) anchor += grew;
        }
        if (!changed) return;
        if (anchor !== 0 && this.offset > 0)
            this.scrollTo(this.offset + anchor);
        // the row a reveal scrolled to stays in view, wherever the measured sizes put it
        const revealing = this.revealing;
        if (revealing) this.revealNow(revealing.itemId, revealing.align);
        this.update(false, true);
    }
}

/** The nearest ancestor of the root (the root included) that scrolls vertically. */
function scrollingAncestor(
    root: HTMLElement,
    view: Window,
): HTMLElement | undefined {
    for (let node: HTMLElement | null = root; node; node = node.parentElement) {
        const { overflowY } = view.getComputedStyle(node);
        if (
            overflowY === "auto" ||
            overflowY === "scroll" ||
            overflowY === "overlay"
        )
            return node;
    }
    return undefined;
}
