// The drag group feature: `dragGroup({ name, transfer? })` joins the trees of one document whose
// models have the same group name, so items drag between them by pointer and keyboard. Over one
// model a drop is one `item.move`; over two it is a transfer (the default one, or the app's
// `transfer`). It needs `dragAndDrop()`, whose drags run through it; the group itself is a
// registry keyed by the roots' document (registry.ts), never a global.
import type { TransferHandler } from "../drop-target/host";
import { dragSessionOf } from "../drop-target/session";
import type { FeatureEngine, TreeFeature } from "../features/types";
import { joinDragGroup } from "./registry";

/** Options of {@link dragGroup}. */
export interface DragGroupOptions {
    /** the group: the trees of one document with the same name share their drags */
    name: string;
    /**
     * what a drop from a tree of another model does here (the receiving tree's, else the source
     * tree's): run the app's commands (copy, convert kinds, …) and return false to refuse; asked
     * first with `dryRun` for each target, which it hides by returning false. Without it, the
     * target model adds the dragged subtrees (`item.add` in a `batch`) and the source model removes
     * them (`item.remove`)
     */
    transfer?: TransferHandler | undefined;
}

/** The drag group feature, as `features` holds it. */
export type DragGroupFeature = TreeFeature<"drag-group">;

/**
 * The drag group feature: every tree on screen of a model with it joins the group `name` of its
 * document, and a drag reaches the other trees of the group
 * (`engine.is("dragging-from-other-tree")` in the trees it started outside of).
 *
 * ```ts
 * import { dragAndDrop } from "@fragiola/tree/drag-and-drop";
 * import { dragGroup } from "@fragiola/tree/drag-group";
 * const features = [dragAndDrop(), dragGroup({ name: "lists" })] as const;
 * const left = createTreeModel(leftJson, { features });
 * const right = createTreeModel(rightJson, { features });
 * ```
 */
export function dragGroup(options: DragGroupOptions): DragGroupFeature {
    const { name, transfer } = options;
    return Object.freeze({
        name: "drag-group",
        requires: ["drag-and-drop"],
        engine: (host): FeatureEngine => {
            const session = dragSessionOf(host);
            if (transfer) session.tune({ transfer });
            let leave: (() => void) | undefined;
            const leaveGroup = () => {
                const left = leave;
                leave = undefined;
                session.group = undefined;
                left?.();
                // a drag from another tree of the group was shown here: it is not any more
                if (session.drag()?.origin) session.setDrag(null);
            };
            return {
                ...session.verbs("drag-group"),
                attached: (root) => {
                    const joined = joinDragGroup(
                        session,
                        name,
                        root.ownerDocument,
                    );
                    session.group = joined.group;
                    leave = joined.leave;
                },
                detached: leaveGroup,
            };
        },
    } satisfies DragGroupFeature);
}
