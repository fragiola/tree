// Expanding and collapsing: `item.expand`, `item.collapse`, `item.toggle`,
// `item.expand-siblings` (the APG `*` key), `tree.expand-all`, `tree.collapse-all`.
import { idListSchema } from "../schema/tree";
import type { Draft } from "../state/draft";
import {
    childIdsOf,
    expandedSet,
    holdsChildren,
    isLeaf,
    parentOf,
} from "../state/structure";
import type { TreeItem } from "../state/types";
import { defineCommand, type Failure, fail, ok } from "./define";
import { isFailure, requireEnabled, settleFocus } from "./rules";

/** `{ itemId }`: the payload of the commands that act on one item. */
export const itemIdPayload = {
    type: "object",
    properties: {
        itemId: { type: "string", minLength: 1, description: "the item" },
    },
    required: ["itemId"],
    additionalProperties: false,
} as const;

/** `{ itemId }`: the result of the commands that report the item they acted on. */
export const itemIdResult = {
    type: "object",
    properties: {
        itemId: { type: "string", description: "the item" },
    },
    required: ["itemId"],
    additionalProperties: false,
} as const;

/** `{}`: the payload of the commands that take nothing. */
export const noPayload = {
    type: "object",
    properties: {},
    additionalProperties: false,
} as const;

/** A parent that may expand: not a leaf, not disabled. */
function requireExpandable(
    draft: Draft,
    itemId: string,
    action: string,
): TreeItem | Failure {
    const item = requireEnabled(draft, itemId, action);
    if (isFailure(item)) return item;
    if (isLeaf(item)) {
        return fail(
            "refused",
            `"${itemId}" is a leaf: it has no children`,
            "/itemId",
        );
    }
    return item;
}

function expand(draft: Draft, ids: readonly string[]): string[] {
    const expanded = expandedSet(draft.state);
    const added = ids.filter((id) => !expanded.has(id));
    if (added.length > 0) {
        draft.set("expandedItemIds", [
            ...draft.state.expandedItemIds,
            ...added,
        ]);
    }
    return added;
}

function collapse(draft: Draft, ids: ReadonlySet<string>): string[] {
    const removed = draft.state.expandedItemIds.filter((id) => ids.has(id));
    if (removed.length > 0) {
        draft.set(
            "expandedItemIds",
            draft.state.expandedItemIds.filter((id) => !ids.has(id)),
        );
        // the focus inside a collapsed item moves to its nearest visible ancestor
        settleFocus(draft);
    }
    return removed;
}

export const itemExpand = defineCommand({
    name: "item.expand",
    description:
        "Expand an item: its children are shown. An item whose children come from the app's loader (`childrenStatus` unloaded) is expanded at once and the engine loads them. Refused for a leaf or a disabled item.",
    payloadSchema: itemIdPayload,
    resultSchema: itemIdResult,
    transient: true,
    reduce: (payload, { draft }) => {
        const item = requireExpandable(draft, payload.itemId, "expand");
        if (isFailure(item)) return item;
        expand(draft, [item.id]);
        return ok({ itemId: item.id });
    },
});

export const itemCollapse = defineCommand({
    name: "item.collapse",
    description:
        "Collapse an item: its children are hidden. When the focused item was inside it, the focus moves to it. Refused for a leaf or a disabled item.",
    payloadSchema: itemIdPayload,
    resultSchema: itemIdResult,
    transient: true,
    reduce: (payload, { draft }) => {
        const item = requireExpandable(draft, payload.itemId, "collapse");
        if (isFailure(item)) return item;
        collapse(draft, new Set([item.id]));
        return ok({ itemId: item.id });
    },
});

export const itemToggle = defineCommand({
    name: "item.toggle",
    description:
        "Expand a collapsed item, or collapse an expanded one. Refused for a leaf or a disabled item.",
    payloadSchema: itemIdPayload,
    resultSchema: {
        type: "object",
        properties: {
            itemId: { type: "string", description: "the item" },
            expanded: {
                type: "boolean",
                description: "whether the item is now expanded",
            },
        },
        required: ["itemId", "expanded"],
        additionalProperties: false,
    },
    transient: true,
    reduce: (payload, { draft }) => {
        const item = requireExpandable(draft, payload.itemId, "toggle");
        if (isFailure(item)) return item;
        const expanded = expandedSet(draft.state).has(item.id);
        if (expanded) collapse(draft, new Set([item.id]));
        else expand(draft, [item.id]);
        return ok({ itemId: item.id, expanded: !expanded });
    },
});

export const itemExpandSiblings = defineCommand({
    name: "item.expand-siblings",
    description:
        "Expand every parent among an item's siblings, the item included (the WAI-ARIA tree's `*` key). Leaves and disabled items are left as they are.",
    payloadSchema: itemIdPayload,
    resultSchema: {
        type: "object",
        properties: {
            expandedItemIds: {
                ...idListSchema,
                description: "the items this expanded",
            },
        },
        required: ["expandedItemIds"],
        additionalProperties: false,
    },
    transient: false,
    reduce: (payload, { draft }) => {
        const parent = parentOf(draft.state, payload.itemId);
        if (parent === undefined) {
            return fail(
                "not_found",
                `"${payload.itemId}" is not an item`,
                "/itemId",
            );
        }
        const siblings = childIdsOf(draft.state, parent).filter((id) => {
            const item = draft.item(id);
            return (
                item !== undefined && !isLeaf(item) && item.disabled !== true
            );
        });
        return ok({ expandedItemIds: expand(draft, siblings) });
    },
});

export const treeExpandAll = defineCommand({
    name: "tree.expand-all",
    description:
        "Expand every parent whose children are loaded (or that holds them itself). Parents whose children come from the loader and are not loaded stay collapsed, so expanding all never starts a load storm; disabled items are left as they are.",
    payloadSchema: noPayload,
    resultSchema: {
        type: "object",
        properties: {
            expandedItemIds: {
                ...idListSchema,
                description: "the items this expanded",
            },
        },
        required: ["expandedItemIds"],
        additionalProperties: false,
    },
    transient: false,
    reduce: (_payload, { draft }) => {
        const parents = Object.values(draft.state.items)
            .filter((item) => holdsChildren(item) && item.disabled !== true)
            .map((item) => item.id);
        return ok({ expandedItemIds: expand(draft, parents) });
    },
});

export const treeCollapseAll = defineCommand({
    name: "tree.collapse-all",
    description:
        "Collapse every item. The focus moves to the root item it was under.",
    payloadSchema: noPayload,
    resultSchema: {
        type: "object",
        properties: {
            collapsedItemIds: {
                ...idListSchema,
                description: "the items this collapsed",
            },
        },
        required: ["collapsedItemIds"],
        additionalProperties: false,
    },
    transient: false,
    reduce: (_payload, { draft }) => {
        const all = new Set(draft.state.expandedItemIds);
        return ok({ collapsedItemIds: collapse(draft, all) });
    },
});
