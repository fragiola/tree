// Inline rename: `item.start-rename`, `item.rename` (commits the label and ends renaming) and
// `item.cancel-rename`. Refused for an item that is disabled or not `renamable`.
import type { Draft } from "../state/draft";
import type { TreeItem } from "../state/types";
import { defineCommand, type Failure, fail, ok } from "./define";
import { itemIdPayload, itemIdResult } from "./expansion";
import { isFailure, requireEnabled, resolveFlags } from "./rules";

function requireRenamable(draft: Draft, itemId: string): TreeItem | Failure {
    const item = requireEnabled(draft, itemId, "be renamed");
    if (isFailure(item)) return item;
    if (!resolveFlags(draft.settings, item).renamable) {
        return fail("refused", `"${itemId}" is not renamable`, "/itemId");
    }
    return item;
}

export const itemStartRename = defineCommand({
    name: "item.start-rename",
    description:
        "Start renaming an item: it becomes the renaming item (the one whose label is edited; any other stops). Refused for an item that is disabled or not renamable.",
    payloadSchema: itemIdPayload,
    resultSchema: itemIdResult,
    transient: false,
    reduce: (payload, { draft }) => {
        const item = requireRenamable(draft, payload.itemId);
        if (isFailure(item)) return item;
        draft.set("renamingItemId", item.id);
        return ok({ itemId: item.id });
    },
});

export const itemRename = defineCommand({
    name: "item.rename",
    description:
        "Set an item's label, and stop renaming it when it was the renaming item. The label is raw model data: the app renders it, the packages never do. Refused for an item that is disabled or not renamable.",
    payloadSchema: {
        type: "object",
        properties: {
            itemId: { type: "string", minLength: 1, description: "the item" },
            label: {
                type: "string",
                minLength: 1,
                description: "the new label (not empty)",
            },
        },
        required: ["itemId", "label"],
        additionalProperties: false,
    },
    resultSchema: itemIdResult,
    transient: false,
    reduce: (payload, { draft }) => {
        const item = requireRenamable(draft, payload.itemId);
        if (isFailure(item)) return item;
        if (item.label !== payload.label) {
            draft.patchItem(item.id, { label: payload.label });
        }
        if (draft.state.renamingItemId === item.id) {
            draft.set("renamingItemId", null);
        }
        return ok({ itemId: item.id });
    },
});

export const itemCancelRename = defineCommand({
    name: "item.cancel-rename",
    description:
        "Stop renaming an item without changing its label. Refused when the item is not the renaming item.",
    payloadSchema: itemIdPayload,
    resultSchema: itemIdResult,
    transient: false,
    reduce: (payload, { draft }) => {
        if (draft.item(payload.itemId) === undefined) {
            return fail(
                "not_found",
                `"${payload.itemId}" is not an item`,
                "/itemId",
            );
        }
        if (draft.state.renamingItemId !== payload.itemId) {
            return fail(
                "refused",
                `"${payload.itemId}" is not being renamed`,
                "/itemId",
            );
        }
        draft.set("renamingItemId", null);
        return ok({ itemId: payload.itemId });
    },
});
