// Drag groups (the engine's `dragGroup` option): the trees of one document with the same group
// name share their drags. The registry is keyed by the roots' document (a `WeakMap`, no global), so
// the trees of two documents (an iframe, a popup) never mix. A drag stays its source tree's: its
// pointer capture, its keys and its announcements; the other trees only show its target
// (`setDrag` with an `origin`) and evaluate it over their own rows.
import type { DragState, DragTree, EngineHost } from "../engine/host";
import type { DropTarget } from "./drop-evaluation";
import { type Landing, landingOf } from "./transfer";

/** `Node.DOCUMENT_POSITION_FOLLOWING`, without the global. */
const FOLLOWING = 4;

/** The trees of one group in one document. */
export class DragGroup {
    readonly members = new Set<EngineHost>();
    /** the drag under way in one of the trees */
    drag: GroupDrag | undefined;

    /** The trees with a root, in document order. */
    trees(): EngineHost[] {
        return [...this.members]
            .filter((host) => host.root() !== undefined && !host.isDestroyed())
            .sort((a, b) =>
                (a.root() as HTMLElement).compareDocumentPosition(
                    b.root() as HTMLElement,
                ) & FOLLOWING
                    ? -1
                    : 1,
            );
    }
}

const groups = new WeakMap<Document, Map<string, DragGroup>>();

/** Adds a tree whose root is in `doc` to the group `name`; returns what removes it. */
export function joinDragGroup(
    host: EngineHost,
    name: string,
    doc: Document,
): { group: DragGroup; leave: () => void } {
    let byName = groups.get(doc);
    if (!byName) {
        byName = new Map();
        groups.set(doc, byName);
    }
    let group = byName.get(name);
    if (!group) {
        group = new DragGroup();
        byName.set(name, group);
    }
    const joined = group;
    joined.members.add(host);
    return {
        group: joined,
        leave: () => {
            if (!joined.members.delete(host)) return;
            joined.drag?.left(host);
            if (joined.members.size === 0 && byName.get(name) === joined)
                byName.delete(name);
        },
    };
}

/**
 * One drag over its source tree and, in a group, the other trees: where the target shows, and how a
 * drop lands in each tree (`landingOf`). Without a group it is the source tree alone.
 */
export class GroupDrag {
    private readonly landings = new Map<EngineHost, Landing>();
    /** the other trees told of the drag */
    private readonly told = new Set<EngineHost>();
    /** the tree whose target shows */
    private shownIn: EngineHost;
    private ended = false;

    constructor(
        readonly source: EngineHost,
        readonly itemIds: readonly string[],
        private readonly mode: DragState["mode"],
        /** a tree left the group during the drag (unmounted, destroyed) */
        private readonly onLeft: (host: EngineHost) => void,
        /** the drag is cancelled from another tree (`engine.run("cancel-drag")` on it) */
        private readonly onCancel: () => void,
    ) {
        this.shownIn = source;
    }

    /** The trees of the drag, in document order: the source alone without a group. */
    trees(): EngineHost[] {
        const group = this.source.dragGroup();
        return group ? group.trees() : [this.source];
    }

    /** How a drop lands in `host` (asked once per tree). */
    landing(host: EngineHost): Landing {
        let landing = this.landings.get(host);
        if (!landing) {
            landing = landingOf(this.source, host, this.itemIds);
            this.landings.set(host, landing);
        }
        return landing;
    }

    /** Starts the drag: the source shows it, and the other trees of its group know of it. */
    begin(target: DropTarget | null): void {
        const group = this.source.dragGroup();
        if (group) {
            group.drag?.onCancel();
            group.drag = this;
            for (const host of group.trees()) {
                if (host === this.source) continue;
                this.told.add(host);
                host.setDrag(this.foreignState(host, null));
            }
        }
        this.show(this.source, target);
    }

    /** Shows `target` in `host` (and no target in the tree that showed one before). */
    show(host: EngineHost, target: DropTarget | null): void {
        if (this.ended) return;
        const previous = this.shownIn;
        this.shownIn = host;
        if (previous !== host && previous !== this.source)
            previous.setDrag(this.foreignState(previous, null));
        if (host === this.source) {
            this.source.setDrag({
                mode: this.mode,
                itemIds: this.itemIds,
                target,
            });
            return;
        }
        if (previous === this.source || this.source.drag()?.target)
            this.source.setDrag({
                mode: this.mode,
                itemIds: this.itemIds,
                target: null,
            });
        this.told.add(host);
        host.setDrag(this.foreignState(host, target));
    }

    /** The tree whose target shows. */
    get host(): EngineHost {
        return this.shownIn;
    }

    private foreignState(
        host: EngineHost,
        target: DropTarget | null,
    ): DragState {
        return {
            mode: this.mode,
            itemIds: host.model === this.source.model ? this.itemIds : [],
            target,
            origin: { cancel: () => this.onCancel() },
        };
    }

    /** A tree left the group (its root detached, its engine destroyed). */
    left(host: EngineHost): void {
        if (this.ended || host === this.source) return;
        this.told.delete(host);
        this.landings.delete(host);
        if (this.shownIn === host) {
            this.shownIn = this.source;
            this.onLeft(host);
        }
    }

    /** Ends the drag in every tree (the source's own state is its caller's). */
    end(): void {
        if (this.ended) return;
        this.ended = true;
        for (const host of this.told)
            if (host.drag()?.origin) host.setDrag(null);
        this.told.clear();
        const group = this.source.dragGroup();
        if (group?.drag === this) group.drag = undefined;
    }
}

/** An announcement's `targetTree`: the tree of a target in another tree of the group. */
export function treeOf(
    source: EngineHost,
    host: EngineHost,
    target: DropTarget | null,
): { targetTree?: DragTree } {
    const root = host.root();
    return host === source || target === null || !root
        ? {}
        : { targetTree: { root, model: host.model } };
}
