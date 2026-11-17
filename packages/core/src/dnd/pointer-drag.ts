// The Pointer Events drag (../guidelines/decisions.md#drag-and-drop): one path for mouse, touch and
// pen. A press on an item's content captures the pointer; past the threshold it is a drag of the
// selection (when the pressed item is selected) or of the item. Every move hit-tests the rows, and
// only a target `model.can` accepts shows; a collapsed parent hovered long enough expands (a
// transient `item.expand`); the nearest scroll container scrolls near its edges. Escape, a
// cancelled pointer or a lost capture end it with nothing committed; a release over a target runs
// one `item.move`.
import { isDragExempt, windowOf } from "../dom/owner";
import type { EngineHost } from "../engine/host";
import { rectOf } from "../geometry/rect";
import type { DropTarget } from "./drop-evaluation";
import { rowAt, targetAt } from "./drop-target";

interface Press {
    readonly itemId: string;
    readonly pointerId: number;
    readonly x: number;
    readonly y: number;
    readonly content: HTMLElement;
}

interface Session {
    readonly itemIds: readonly string[];
    x: number;
    y: number;
    hoveredItemId: string | undefined;
    cancelExpand: (() => void) | undefined;
    cancelScroll: (() => void) | undefined;
    scrollSpeed: number;
}

const sameTarget = (a: DropTarget | null, b: DropTarget | null) =>
    a === b ||
    (a !== null &&
        b !== null &&
        a.parentItemId === b.parentItemId &&
        a.index === b.index &&
        a.position === b.position &&
        a.itemId === b.itemId &&
        a.level === b.level);

export class PointerDrag {
    private press: Press | undefined;
    private session: Session | undefined;
    private release: (() => void)[] = [];
    /** a drag just ended: the click its release causes is not a click */
    private suppressClick = false;

    constructor(private readonly host: EngineHost) {}

    /** Whether the click that follows a drag's release must be ignored (it resets the flag). */
    consumeClick(): boolean {
        const suppressed = this.suppressClick;
        this.suppressClick = false;
        return suppressed;
    }

    /** A pointer pressed an item's content element. */
    pointerDown(
        itemId: string,
        event: PointerEvent,
        content: HTMLElement,
    ): void {
        const { model } = this.host;
        if (this.press || this.session || this.host.drag()) return;
        if (event.button !== 0 || event.isPrimary === false) return;
        if (isDragExempt(event.target, content)) return;
        if (model.state.renamingItemId === itemId) return;
        const doc = content.ownerDocument;
        this.press = {
            itemId,
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            content,
        };
        this.suppressClick = false;
        const listen = <K extends keyof DocumentEventMap>(
            target: Document | HTMLElement,
            type: K,
            listener: (event: DocumentEventMap[K]) => void,
        ) => {
            const handler = listener as EventListener;
            target.addEventListener(type, handler);
            this.release.push(() => target.removeEventListener(type, handler));
        };
        listen(doc, "pointermove", (move) => this.pointerMove(move));
        listen(doc, "pointerup", (up) => this.pointerUp(up));
        listen(doc, "pointercancel", (gone) => {
            if (gone.pointerId === this.press?.pointerId) this.cancel();
        });
        listen(doc, "keydown", (key) => {
            if (key.key === "Escape" && this.session) {
                key.preventDefault();
                this.cancel();
            }
        });
        listen(content, "lostpointercapture", () => {
            if (this.session) this.cancel();
        });
    }

    private pointerMove(event: PointerEvent): void {
        const press = this.press;
        if (!press || event.pointerId !== press.pointerId) return;
        if (!this.session) {
            const distance = Math.hypot(
                event.clientX - press.x,
                event.clientY - press.y,
            );
            // under the threshold a press is still a click
            if (distance < this.host.options.dragThreshold) return;
            if (!this.start(press)) {
                this.end();
                return;
            }
        }
        const session = this.session;
        if (!session) return;
        event.preventDefault();
        session.x = event.clientX;
        session.y = event.clientY;
        this.hover();
        this.updateScroll();
    }

    /** Turns the press into a drag; false when its items cannot move. */
    private start(press: Press): boolean {
        const { model } = this.host;
        const selected = model.state.selectedItemIds;
        const itemIds = selected.includes(press.itemId)
            ? [...selected]
            : [press.itemId];
        if (!itemIds.every((itemId) => model.is("item-movable", { itemId }))) {
            return false;
        }
        try {
            press.content.setPointerCapture?.(press.pointerId);
        } catch {
            // a pointer that is gone already: the document listeners still follow it
        }
        this.session = {
            itemIds,
            x: press.x,
            y: press.y,
            hoveredItemId: undefined,
            cancelExpand: undefined,
            cancelScroll: undefined,
            scrollSpeed: 0,
        };
        this.host.setDrag({ mode: "pointer", itemIds, target: null });
        this.host.announce({ type: "drag-start", itemIds, keyboard: false });
        return true;
    }

    /** Hit-tests the pointer: the drop target, and the auto-expand timer of a hovered parent. */
    private hover(): void {
        const session = this.session;
        if (!session) return;
        const { model, options } = this.host;
        const target = targetAt(
            this.host,
            session.itemIds,
            session.x,
            session.y,
        );
        const previous = this.host.drag()?.target ?? null;
        if (!sameTarget(previous, target)) {
            this.host.setDrag({
                mode: "pointer",
                itemIds: session.itemIds,
                target,
            });
            this.host.announce({
                type: "drag-over",
                itemIds: session.itemIds,
                target,
            });
        }
        // a collapsed parent under the pointer expands after a delay
        const visible = model.get("visible-items");
        const row = rowAt(this.host, visible, session.y);
        const hovered = row && visible[row.index]?.itemId;
        if (hovered === session.hoveredItemId) return;
        session.hoveredItemId = hovered;
        session.cancelExpand?.();
        session.cancelExpand = undefined;
        if (
            hovered === undefined ||
            model.is("item-leaf", { itemId: hovered }) ||
            model.is("item-expanded", { itemId: hovered }) ||
            session.itemIds.includes(hovered)
        ) {
            return;
        }
        session.cancelExpand = this.host.scheduler().setTimeout(() => {
            if (this.session !== session || session.hoveredItemId !== hovered)
                return;
            session.cancelExpand = undefined;
            const expanded = model.run(
                "item.expand",
                { itemId: hovered },
                {
                    transient: true,
                    meta: { source: "drag" },
                },
            );
            if (expanded.ok) {
                session.hoveredItemId = undefined;
                this.hover();
            }
        }, options.autoExpandDelay);
    }

    /** Scrolls the nearest scroll container while the pointer is near its top or bottom edge. */
    private updateScroll(): void {
        const session = this.session;
        const root = this.host.root();
        if (!session || !root) return;
        const container = scrollParent(root);
        if (!container) return;
        const rect = rectOf(container);
        const { threshold, speed } = this.host.options.autoScroll;
        const edge = Math.min(threshold, rect.height / 2);
        let velocity = 0;
        if (edge > 0) {
            const fromTop = session.y - rect.top;
            const fromBottom = rect.top + rect.height - session.y;
            if (fromTop < edge)
                velocity = -speed * (1 - Math.max(0, fromTop) / edge);
            else if (fromBottom < edge)
                velocity = speed * (1 - Math.max(0, fromBottom) / edge);
        }
        session.scrollSpeed = velocity;
        if (velocity === 0) {
            session.cancelScroll?.();
            session.cancelScroll = undefined;
            return;
        }
        if (session.cancelScroll) return;
        const step = () => {
            if (this.session !== session || session.scrollSpeed === 0) {
                session.cancelScroll = undefined;
                return;
            }
            container.scrollTop += session.scrollSpeed;
            this.hover();
            session.cancelScroll = this.host.scheduler().requestFrame(step);
        };
        session.cancelScroll = this.host.scheduler().requestFrame(step);
    }

    private pointerUp(event: PointerEvent): void {
        const press = this.press;
        if (!press || event.pointerId !== press.pointerId) return;
        const session = this.session;
        if (!session) {
            this.end();
            return;
        }
        session.x = event.clientX;
        session.y = event.clientY;
        this.hover();
        const target = this.host.drag()?.target ?? null;
        this.suppressClick = true;
        // the click a release fires comes in this task; a later one is a click again
        this.host.scheduler().setTimeout(() => {
            this.suppressClick = false;
        }, 0);
        this.end();
        if (target === null) {
            this.host.announce({
                type: "drag-cancel",
                itemIds: session.itemIds,
            });
            return;
        }
        const moved = this.host.model.run(
            "item.move",
            {
                itemIds: [...session.itemIds],
                to: { parentItemId: target.parentItemId, index: target.index },
            },
            { meta: { source: "drag" } },
        );
        if (moved.ok) {
            this.host.announce({
                type: "drop",
                itemIds: session.itemIds,
                target,
            });
        } else {
            this.host.announce({
                type: "drag-cancel",
                itemIds: session.itemIds,
            });
        }
    }

    /** Ends the press or the drag with nothing committed. */
    cancel(): void {
        const session = this.session;
        this.end();
        if (session)
            this.host.announce({
                type: "drag-cancel",
                itemIds: session.itemIds,
            });
    }

    get active(): boolean {
        return this.session !== undefined;
    }

    /** A press (not yet a drag) or a drag is under way. */
    get pressed(): boolean {
        return this.press !== undefined;
    }

    private end(): void {
        const session = this.session;
        const press = this.press;
        for (const release of this.release.splice(0)) release();
        if (session) {
            session.cancelExpand?.();
            session.cancelScroll?.();
            if (press?.content.hasPointerCapture?.(press.pointerId)) {
                try {
                    press.content.releasePointerCapture(press.pointerId);
                } catch {
                    // released already
                }
            }
        }
        this.press = undefined;
        this.session = undefined;
        if (session && this.host.drag()?.mode === "pointer")
            this.host.setDrag(null);
    }
}

/** The nearest scroll container of the root (the root itself when it scrolls). */
function scrollParent(root: HTMLElement): HTMLElement | undefined {
    const view = windowOf(root);
    if (!view) return undefined;
    for (let node: HTMLElement | null = root; node; node = node.parentElement) {
        const { overflowY } = view.getComputedStyle(node);
        if (overflowY === "auto" || overflowY === "scroll") return node;
    }
    return undefined;
}
