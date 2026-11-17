// Drag groups (`dragGroup({ name })`): the trees of one document with the same group
// name share their drags. The registry is keyed by the roots' document (a `WeakMap`, no global), so
// the trees of two documents (an iframe, a popup) never mix. A drag stays its source tree's: its
// pointer capture, its keys and its announcements; the other trees only show its target
// (`setDrag` with an `origin`) and evaluate it over their own rows.
import type {
    DragGroupLike,
    DragHost,
    GroupDragLike,
} from "../drop-target/host";

/** `Node.DOCUMENT_POSITION_FOLLOWING`, without the global. */
const FOLLOWING = 4;

/** The trees of one group in one document. */
export class DragGroup implements DragGroupLike {
    readonly members = new Set<DragHost>();
    /** the drag under way in one of the trees */
    drag: GroupDragLike | undefined;

    /** The trees with a root, in document order. */
    trees(): DragHost[] {
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
    host: DragHost,
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
