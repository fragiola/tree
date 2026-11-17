// Async children: the lifecycle of a parent whose children come from the app's loader.
// `item.set-children-status` (loading, error), `item.set-children` (the loaded children: status
// loaded) and `item.reset-children` (back to unloaded, for a reload). The engine runs them around
// the app's `loadChildren`; the package itself never loads anything.
import { idListSchema, itemJsonSchema } from "../schema/tree";
import { inheritCheck, settleAncestors } from "../state/check-state";
import type { Draft } from "../state/draft";
import type { TreeItem } from "../state/types";
import { defineCommand, type Failure, fail, ok } from "./define";
import { itemIdPayload } from "./expansion";
import { newItem, removeSubtrees } from "./item";
import { isFailure, requireItem } from "./rules";

/** An item whose children come from the loader (it has a `childrenStatus`). */
function requireAsync(draft: Draft, itemId: string): TreeItem | Failure {
    const item = requireItem(draft, itemId);
    if (isFailure(item)) return item;
    if (item.childrenStatus === undefined) {
        return fail(
            "refused",
            `"${itemId}" holds its children itself: it has no childrenStatus`,
            "/itemId",
        );
    }
    return item;
}

export const itemSetChildrenStatus = defineCommand({
    name: "item.set-children-status",
    description:
        "Mark the load of an item's children as started (loading) or failed (error). Only for an item whose children come from the loader (it has a childrenStatus); its current children, if any, are removed. The engine runs it around the app's loadChildren.",
    payloadSchema: {
        type: "object",
        properties: {
            itemId: { type: "string", minLength: 1, description: "the item" },
            status: {
                enum: ["loading", "error"],
                description: "loading: the load started; error: it failed",
            },
        },
        required: ["itemId", "status"],
        additionalProperties: false,
    },
    resultSchema: {
        type: "object",
        properties: {
            itemId: { type: "string", description: "the item" },
        },
        required: ["itemId"],
        additionalProperties: false,
    },
    transient: false,
    reduce: (payload, { draft }) => {
        const item = requireAsync(draft, payload.itemId);
        if (isFailure(item)) return item;
        removeSubtrees(draft, item.childItemIds ?? []);
        draft.patchItem(item.id, {
            childrenStatus: payload.status,
            childItemIds: undefined,
        });
        return ok({ itemId: item.id });
    },
});

export const itemSetChildren = defineCommand({
    name: "item.set-children",
    description:
        "Give an item the children the app's loader returned (each an item JSON, its id generated when omitted; a child that has children of its own gets a childrenStatus and loads them later). They replace any current children, and the status becomes loaded. In cascade mode they inherit a checked parent. Only for an item whose children come from the loader.",
    payloadSchema: {
        type: "object",
        properties: {
            itemId: { type: "string", minLength: 1, description: "the item" },
            items: {
                type: "array",
                items: itemJsonSchema,
                description: "the children, in order",
            },
        },
        required: ["itemId", "items"],
        additionalProperties: false,
    },
    resultSchema: {
        type: "object",
        properties: {
            itemId: { type: "string", description: "the item" },
            childItemIds: {
                ...idListSchema,
                description: "the children's ids, in order",
            },
        },
        required: ["itemId", "childItemIds"],
        additionalProperties: false,
    },
    transient: false,
    reduce: (payload, context) => {
        const { draft } = context;
        const item = requireAsync(draft, payload.itemId);
        if (isFailure(item)) return item;
        const old = new Set(item.childItemIds ?? []);
        removeSubtrees(draft, [...old]);
        const children: TreeItem[] = [];
        const reserved = new Set<string>();
        for (const [i, json] of payload.items.entries()) {
            const child = newItem(context, json, `/items/${i}`, reserved);
            if (isFailure(child)) return child;
            reserved.add(child.id);
            children.push(child);
        }
        for (const child of children) draft.setItem(child);
        const childItemIds = children.map((child) => child.id);
        draft.patchItem(item.id, { childrenStatus: "loaded", childItemIds });
        inheritCheck(draft, item.id, childItemIds);
        settleAncestors(draft, item.id);
        return ok({ itemId: item.id, childItemIds });
    },
});

export const itemResetChildren = defineCommand({
    name: "item.reset-children",
    description:
        "Forget an item's loaded children (and everything inside them): its status goes back to unloaded, so the next expand loads them again. Only for an item whose children come from the loader.",
    payloadSchema: itemIdPayload,
    resultSchema: {
        type: "object",
        properties: {
            itemId: { type: "string", description: "the item" },
            removedItemIds: {
                ...idListSchema,
                description: "the items removed",
            },
        },
        required: ["itemId", "removedItemIds"],
        additionalProperties: false,
    },
    transient: false,
    reduce: (payload, { draft }) => {
        const item = requireAsync(draft, payload.itemId);
        if (isFailure(item)) return item;
        const removedItemIds = removeSubtrees(draft, item.childItemIds ?? []);
        draft.patchItem(item.id, {
            childrenStatus: "unloaded",
            childItemIds: undefined,
        });
        return ok({ itemId: item.id, removedItemIds });
    },
});
