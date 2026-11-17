// The Pointer Events drag (../guidelines/decisions.md#drag-and-drop): one path for mouse, touch and
// pen. A press on an item's content captures the pointer; past the threshold it is a drag of the
// selection (when the pressed item is selected) or of the item. Every move hit-tests the rows, and
// only a target `model.can` accepts shows; a collapsed parent hovered long enough expands (a
// transient `item.expand`); the nearest scroll container scrolls near its edges. Escape, a
// cancelled pointer or a lost capture end it with nothing committed; a release over a target runs
// one `item.move`. In a drag group the pointer also reaches the other trees: the capture stays on
// the source, the tree under the pointer is found by its root's rect, and that tree evaluates,
// shows, expands and scrolls its target; a drop there lands as transfer.ts says.

import { isDragExempt } from "../dom/owner";
import type { DropTarget } from "../drop-target/drop-evaluation";
import { overRoot, rowAt, targetAt } from "../drop-target/drop-target";
import type { DragHost } from "../drop-target/host";
import {
    type DragModifiers,
    modifiersOf,
    NO_MODIFIERS,
} from "../drop-target/host";
import type { FeatureModel } from "../features/types";
import { rectOf } from "../geometry/rect";
import { dragSetOf } from "./drag-set";
import { GroupDrag, treeOf } from "./group-drag";

interface Press {
    readonly itemId: string;
    readonly pointerId: number;
    readonly x: number;
    readonly y: number;
    readonly content: HTMLElement;
}

interface Session {
    readonly itemIds: readonly string[];
    readonly drag: GroupDrag;
    x: number;
    y: number;
    modifiers: DragModifiers;
    /** the tree under the pointer (the source when none of the group is) */
    over: DragHost;
    target: DropTarget | null;
    hoveredItemId: string | undefined;
    cancelExpand: (() => void) | undefined;
    cancelScroll: (() => void) | undefined;
    scrollSpeed: number;
    /** the scroll container the drag scrolls (the hovered tree's) */
    container: HTMLElement | undefined;
    /** the pointer is outside every tree of the drag */
    outside: boolean;
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

    constructor(private readonly host: DragHost) {}

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
        if ((model as unknown as FeatureModel).is("item-renaming", { itemId }))
            return;
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
            // a row a virtualized tree no longer renders loses the capture: the document's
            // listeners still follow the pointer
            if (
                this.session &&
                (content.isConnected || this.host.renderedRows() === undefined)
            )
                this.cancel();
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
        session.modifiers = modifiersOf(event);
        this.hover();
        this.updateScroll();
    }

    /** Turns the press into a drag; false when its items cannot move. */
    private start(press: Press): boolean {
        const { model } = this.host;
        const itemIds = dragSetOf(model, press.itemId);
        if (!itemIds.every((itemId) => model.is("item-movable", { itemId }))) {
            return false;
        }
        try {
            press.content.setPointerCapture?.(press.pointerId);
        } catch {
            // a pointer that is gone already: the document listeners still follow it
        }
        const drag = new GroupDrag(
            this.host,
            itemIds,
            "pointer",
            () => {
                // the tree under the pointer left: the pointer finds what is there now
                const session = this.session;
                if (session?.drag !== drag) return;
                session.over = this.host;
                session.target = null;
                session.hoveredItemId = undefined;
                session.cancelExpand?.();
                session.cancelExpand = undefined;
                this.hover();
            },
            () => this.cancel(),
        );
        this.session = {
            itemIds,
            drag,
            x: press.x,
            y: press.y,
            modifiers: NO_MODIFIERS,
            over: this.host,
            target: null,
            hoveredItemId: undefined,
            cancelExpand: undefined,
            cancelScroll: undefined,
            scrollSpeed: 0,
            container: undefined,
            outside: false,
        };
        drag.begin(null);
        this.host.announce({
            type: "drag-start",
            itemIds,
            keyboard: false,
            target: null,
        });
        return true;
    }

    /** The tree of the drag under a point: the source's, another of its group's, or none. */
    private treeAt(session: Session): DragHost | undefined {
        const { x, y } = session;
        if (overRoot(this.host, x, y)) return this.host;
        return session.drag
            .trees()
            .find((host) => host !== this.host && overRoot(host, x, y, true));
    }

    /** Hit-tests the pointer: the drop target, and the auto-expand timer of a hovered parent. */
    private hover(): void {
        const session = this.session;
        if (!session) return;
        let over = this.treeAt(session);
        // with a drop outside, the part of the source's root its scroll container hides (a
        // virtualized tree's rows out of view) is outside too
        if (
            over === this.host &&
            this.host.dropOutside() &&
            !overRoot(this.host, session.x, session.y, true)
        )
            over = undefined;
        const host = over ?? this.host;
        const target = over
            ? targetAt(
                  over,
                  session.drag.landing(over),
                  session.x,
                  session.y,
                  session.modifiers,
              )
            : null;
        const previous = session.target;
        const moved = host !== session.over;
        if (moved) {
            session.cancelExpand?.();
            session.cancelExpand = undefined;
            session.hoveredItemId = undefined;
        }
        session.over = host;
        session.target = target;
        session.outside = !over;
        // the app's targets outside every tree see the element under the pointer
        this.host.dropOutside()?.over(over ? undefined : session.x, session.y);
        if (moved || !sameTarget(previous, target)) {
            session.drag.show(host, target);
            this.host.announce({
                type: "drag-over",
                itemIds: session.itemIds,
                target,
                ...treeOf(this.host, host, target),
            });
        }
        if (!over) {
            session.hoveredItemId = undefined;
            session.cancelExpand?.();
            session.cancelExpand = undefined;
            return;
        }
        const { model } = over;
        // a collapsed parent under the pointer expands after a delay
        const visible = model.get("visible-items");
        const row = rowAt(over, visible, session.y);
        const hovered = row && visible[row.index]?.itemId;
        if (hovered === session.hoveredItemId) return;
        session.hoveredItemId = hovered;
        session.cancelExpand?.();
        session.cancelExpand = undefined;
        if (
            hovered === undefined ||
            model.is("item-leaf", { itemId: hovered }) ||
            model.is("item-expanded", { itemId: hovered }) ||
            (model === this.host.model && session.itemIds.includes(hovered))
        ) {
            return;
        }
        session.cancelExpand = this.host.scheduler().setTimeout(() => {
            if (
                this.session !== session ||
                session.over !== over ||
                session.hoveredItemId !== hovered ||
                over.isDestroyed()
            )
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
        }, over.options.autoExpandDelay);
    }

    /** Scrolls the nearest scroll container while the pointer is near its top or bottom edge. */
    private updateScroll(): void {
        const session = this.session;
        if (!session || !this.host.root()) return;
        // a drag outside every tree, toward the app's targets, scrolls nothing
        const container =
            session.outside && this.host.dropOutside()
                ? undefined
                : session.over.scrollContainer();
        if (session.container !== container) {
            session.cancelScroll?.();
            session.cancelScroll = undefined;
            session.container = container;
        }
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
            if (
                this.session !== session ||
                session.scrollSpeed === 0 ||
                session.container !== container
            ) {
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
        session.modifiers = modifiersOf(event);
        this.hover();
        const { target, over } = session;
        this.suppressClick = true;
        // the click a release fires comes in this task; a later one is a click again
        this.host.scheduler().setTimeout(() => {
            this.suppressClick = false;
        }, 0);
        this.end();
        // released outside every tree: the app's `dropOutside` may take the items
        const outside =
            target === null && session.outside
                ? this.host
                      .dropOutside()
                      ?.drop(
                          session.itemIds,
                          session.x,
                          session.y,
                          session.modifiers,
                      )
                : undefined;
        if (outside !== undefined) {
            this.host.announce({
                type: "drop-outside",
                itemIds: session.itemIds,
                element: outside,
            });
            return;
        }
        if (target === null || over.isDestroyed()) {
            this.host.announce({
                type: "drag-cancel",
                itemIds: session.itemIds,
            });
            return;
        }
        const dropped = session.drag
            .landing(over)
            .drop(target, session.modifiers, "drag");
        if (dropped) {
            this.host.announce({
                type: "drop",
                itemIds: session.itemIds,
                target,
                ...treeOf(this.host, over, target),
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

    /** The item a pointer pressed (its content holds the pointer capture), while it does. */
    get pressedItemId(): string | undefined {
        return this.press?.itemId;
    }

    private end(): void {
        const session = this.session;
        const press = this.press;
        for (const release of this.release.splice(0)) release();
        if (session) {
            this.host.dropOutside()?.over();
            session.drag.end();
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
