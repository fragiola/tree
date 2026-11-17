// How a drop lands in a tree of the drag (drag-group.ts): in a tree of the source's model, one
// `item.move` (the model moves items between parents); in a tree of another model, a transfer: by
// default the target model adds the dragged subtrees (one `batch` of `item.add`, ids kept) and the
// source model removes them (`item.remove`), each through its own middleware; the app's `transfer`
// option replaces it (copy, convert kinds, refuse). Every target is asked of the models (or the
// app) before it shows, as a move's is.
import type { BatchEntry } from "../commands/types";
import type { DropTarget } from "../drop-target/drop-evaluation";
import {
    type DragHost,
    type DragModifiers,
    type Landing,
    NO_MODIFIERS,
    type TreeTransfer,
} from "../drop-target/host";
import { cloneJson, itemToJson, type TreeItemInit } from "../state/json";
import type { TreeModel } from "../state/model";

/** Whether a model takes moving `itemIds` to `target`. */
export function movable(
    model: TreeModel,
    itemIds: readonly string[],
    target: DropTarget,
): boolean {
    return model.can("item.move", {
        itemIds: [...itemIds],
        to: { parentItemId: target.parentItemId, index: target.index },
    });
}

/** How a drag of `itemIds` from `from` lands in `to`. */
export function landingOf(
    from: DragHost,
    to: DragHost,
    itemIds: readonly string[],
): Landing {
    if (to.model === from.model) {
        return {
            excludedItemIds: itemIds,
            accepts: (target) => movable(to.model, itemIds, target),
            drop: (target, _modifiers, source) =>
                to.model.run(
                    "item.move",
                    {
                        itemIds: [...itemIds],
                        to: {
                            parentItemId: target.parentItemId,
                            index: target.index,
                        },
                    },
                    { meta: { source } },
                ).ok,
        };
    }
    return transferLanding(from, to, itemIds);
}

/** A drop in a tree of another model: the app's transfer, or the default one. */
function transferLanding(
    from: DragHost,
    to: DragHost,
    itemIds: readonly string[],
): Landing {
    const handler = to.options.transfer ?? from.options.transfer;
    const outer = outermostInOrder(from.model, itemIds);
    let subtrees: SubtreeEntry[] | undefined;
    let removable: boolean | undefined;
    const transferOf = (
        target: DropTarget,
        modifiers: DragModifiers,
        dryRun: boolean,
    ): TreeTransfer => {
        subtrees ??= subtreeEntries(from.model, outer);
        return {
            itemIds: outer,
            items: outer.flatMap((id) => {
                const item = from.model.get("item-by", { id });
                return item ? [item] : [];
            }),
            from: from.model,
            to: {
                model: to.model,
                parentItemId: target.parentItemId,
                index: target.index,
            },
            commands: commandsOf(subtrees, target),
            modifiers,
            dryRun,
        };
    };
    const defaultAccepts = (transfer: TreeTransfer) => {
        removable ??= from.model.can("item.remove", { itemIds: [...outer] });
        return (
            removable &&
            to.model.can("batch", { commands: [...transfer.commands] })
        );
    };
    return {
        excludedItemIds: [],
        accepts: (target, modifiers = NO_MODIFIERS) => {
            const transfer = transferOf(target, modifiers, true);
            const answer = handler?.(transfer);
            return answer === undefined ? defaultAccepts(transfer) : answer;
        },
        drop: (target, modifiers, source) => {
            const transfer = transferOf(target, modifiers, false);
            const answer = handler?.(transfer);
            // the handler ran its own commands (true) or refused (false); nothing: the default
            if (answer !== undefined) return answer;
            // the source must still let them go before the target takes them
            if (!from.model.check("item.remove", { itemIds: [...outer] }).ok)
                return false;
            const added = to.model.run(
                "batch",
                { commands: [...transfer.commands] },
                { meta: { source } },
            );
            if (!added.ok) return false;
            return from.model.run(
                "item.remove",
                { itemIds: [...outer] },
                { meta: { source } },
            ).ok;
        },
    };
}

/** An item to add: its JSON, and its parent among the added items (undefined: a dragged item). */
interface SubtreeEntry {
    readonly item: TreeItemInit;
    readonly parentItemId: string | undefined;
    /** it shows its children in the source: it is expanded in the target too */
    readonly expanded: boolean;
}

/** The outermost of `itemIds` (none inside another), in tree order. */
function outermostInOrder(
    model: TreeModel,
    itemIds: readonly string[],
): string[] {
    const wanted = new Set(itemIds);
    const found: string[] = [];
    const stack = [...model.state.rootItemIds].reverse();
    while (stack.length > 0 && found.length < wanted.size) {
        const id = stack.pop() as string;
        if (wanted.has(id)) {
            found.push(id);
            continue;
        }
        const children = model.state.items[id]?.childItemIds ?? [];
        for (let i = children.length - 1; i >= 0; i--)
            stack.push(children[i] as string);
    }
    return found;
}

/** The dragged subtrees as items to add, parents first. */
function subtreeEntries(
    model: TreeModel,
    outer: readonly string[],
): SubtreeEntry[] {
    const entries: SubtreeEntry[] = [];
    const visit = (id: string, parentItemId: string | undefined) => {
        const item = model.state.items[id];
        if (!item) return;
        const json = itemToJson(item);
        const status = item.childrenStatus;
        if (status === "loading" || status === "error") {
            // the target's loader fills it
            json.childrenStatus = "unloaded";
            delete json.childItemIds;
        } else if (json.childItemIds) {
            json.childItemIds = [];
        }
        entries.push({
            item: json,
            parentItemId,
            // a disabled item takes no expand, and a folder left to the loader stays closed
            expanded:
                status !== "loading" &&
                status !== "error" &&
                item.disabled !== true &&
                (item.childItemIds !== undefined ||
                    item.childrenStatus !== undefined) &&
                model.is("item-expanded", { itemId: id }),
        });
        if (status === "loading" || status === "error") return;
        for (const child of item.childItemIds ?? []) visit(child, id);
    };
    for (const id of outer) visit(id, undefined);
    return entries;
}

/** The `item.add` commands of the subtrees for a drop at `target`, then their expansion. */
function commandsOf(
    entries: readonly SubtreeEntry[],
    target: DropTarget,
): BatchEntry[] {
    let next = target.index;
    const added: BatchEntry[] = entries.map(({ item, parentItemId }) => ({
        command: "item.add",
        payload: {
            item: structuredJson(item),
            to:
                parentItemId === undefined
                    ? { parentItemId: target.parentItemId, index: next++ }
                    : { parentItemId },
        },
    }));
    for (const { item, expanded } of entries)
        if (expanded && item.id !== undefined)
            added.push({
                command: "item.expand",
                payload: { itemId: item.id },
            });
    return added;
}

/** A fresh copy of an item's JSON (each command owns its payload). */
function structuredJson(item: TreeItemInit): TreeItemInit {
    return {
        ...item,
        ...(item.childItemIds ? { childItemIds: [...item.childItemIds] } : {}),
        ...(item.data !== undefined ? { data: cloneJson(item.data) } : {}),
    };
}
