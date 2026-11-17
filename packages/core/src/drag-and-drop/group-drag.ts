// One drag over its source tree and, in a drag group (`dragGroup()`), the other trees: where the
// target shows, and how a drop lands in each tree (transfer.ts). Without a group it is the source
// tree alone, so drag and drop works the same with or without groups.

import type { DropTarget } from "../drop-target/drop-evaluation";
import type {
    DragHost,
    DragState,
    GroupDragLike,
    Landing,
} from "../drop-target/host";
import type { DragTree } from "../engine/host";
import { landingOf } from "./transfer";

/**
 * One drag over its source tree and, in a group, the other trees: where the target shows, and how a
 * drop lands in each tree (`landingOf`). Without a group it is the source tree alone.
 */
export class GroupDrag implements GroupDragLike {
    private readonly landings = new Map<DragHost, Landing>();
    /** the other trees told of the drag */
    private readonly told = new Set<DragHost>();
    /** the tree whose target shows */
    private shownIn: DragHost;
    private ended = false;

    constructor(
        readonly source: DragHost,
        readonly itemIds: readonly string[],
        private readonly mode: DragState["mode"],
        /** a tree left the group during the drag (unmounted, destroyed) */
        private readonly onLeft: (host: DragHost) => void,
        /** the drag is cancelled from another tree (`engine.run("cancel-drag")` on it) */
        private readonly onCancel: () => void,
    ) {
        this.shownIn = source;
    }

    /** The trees of the drag, in document order: the source alone without a group. */
    trees(): DragHost[] {
        const group = this.source.dragGroup();
        return group ? group.trees() : [this.source];
    }

    /** How a drop lands in `host` (asked once per tree). */
    landing(host: DragHost): Landing {
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
            group.drag?.cancelFromGroup();
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
    show(host: DragHost, target: DropTarget | null): void {
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
    get host(): DragHost {
        return this.shownIn;
    }

    private foreignState(host: DragHost, target: DropTarget | null): DragState {
        return {
            mode: this.mode,
            itemIds: host.model === this.source.model ? this.itemIds : [],
            target,
            origin: { cancel: () => this.onCancel() },
        };
    }

    /** The drag is cancelled from another tree of the group. */
    cancelFromGroup(): void {
        this.onCancel();
    }

    /** A tree left the group (its root detached, its engine destroyed). */
    left(host: DragHost): void {
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
    source: DragHost,
    host: DragHost,
    target: DropTarget | null,
): { targetTree?: DragTree } {
    const root = host.root();
    return host === source || target === null || !root
        ? {}
        : { targetTree: { root, model: host.model } };
}
