// The selection's commands: `item.select` (replace, toggle, extend), `tree.select`,
// `tree.select-all` and `tree.clear-selection`. Every one honours `settings.selectionMode`: `none`
// refuses them, `single` never holds two items.
import { defineCommand, type Failure, fail, ok } from "../commands/define";
import { noPayload } from "../commands/expansion";
import { isFailure, requireEnabled, resolveFlags } from "../commands/rules";
import { idListSchema } from "../schema/tree";
import type { Draft } from "../state/draft";
import type { TreeItem } from "../state/types";
import { visibleIndex, visibleItems } from "../state/visible-items";
import {
    anchorOf,
    draftSlice,
    modeOf,
    selectedOf,
    setAnchor,
    setSelected,
} from "./state";

const selectionResult = {
    type: "object",
    properties: {
        selectedItemIds: {
            ...idListSchema,
            description: "the selection after the command",
        },
    },
    required: ["selectedItemIds"],
    additionalProperties: false,
} as const;

/** Refused when the selection mode is `none`. */
function selectable(draft: Draft): Failure | undefined {
    return modeOf(draftSlice(draft)) === "none"
        ? fail(
              "refused",
              'the selection mode is "none": nothing can be selected',
          )
        : undefined;
}

function isEnabled(draft: Draft, item: TreeItem | undefined): boolean {
    return item !== undefined && !resolveFlags(draft.settings, item).disabled;
}

function select(draft: Draft, ids: readonly string[]): string[] {
    const next = [...ids];
    const current = selectedOf(draftSlice(draft));
    const same =
        next.length === current.length &&
        next.every((id, i) => current[i] === id);
    if (!same) setSelected(draft, next);
    return next;
}

export const itemSelect = defineCommand({
    name: "item.select",
    description:
        "Select an item. `mode` replace (default) selects it alone and makes it the selection anchor; toggle adds or removes it and makes it the anchor; extend selects the visible items from the anchor to it (multiple mode; in single mode it acts as replace). Disabled items are never selected. Refused when the selection mode is none.",
    payloadSchema: {
        type: "object",
        properties: {
            itemId: { type: "string", minLength: 1, description: "the item" },
            mode: {
                enum: ["replace", "toggle", "extend"],
                description:
                    "replace (default): the item alone; toggle: added or removed; extend: the visible range from the selection anchor",
            },
        },
        required: ["itemId"],
        additionalProperties: false,
    },
    resultSchema: selectionResult,
    transient: false,
    reduce: (payload, { draft }) => {
        const refused = selectable(draft);
        if (refused) return refused;
        const item = requireEnabled(draft, payload.itemId, "be selected");
        if (isFailure(item)) return item;
        const single = modeOf(draftSlice(draft)) === "single";
        const mode = payload.mode ?? "replace";
        const current = selectedOf(draftSlice(draft));
        if (mode === "toggle") {
            setAnchor(draft, item.id);
            if (current.includes(item.id)) {
                return ok({
                    selectedItemIds: select(
                        draft,
                        current.filter((id) => id !== item.id),
                    ),
                });
            }
            return ok({
                selectedItemIds: select(
                    draft,
                    single ? [item.id] : [...current, item.id],
                ),
            });
        }
        if (mode === "extend" && !single) {
            const visible = visibleItems(draft.state);
            const index = visibleIndex(draft.state);
            const anchor = [
                anchorOf(draftSlice(draft)),
                draft.state.focusedItemId,
            ].find((id) => id !== null && index.has(id));
            const to = index.get(item.id);
            if (anchor === undefined || anchor === null || to === undefined) {
                setAnchor(draft, item.id);
                return ok({ selectedItemIds: select(draft, [item.id]) });
            }
            setAnchor(draft, anchor);
            const from = index.get(anchor) ?? to;
            const range = visible
                .slice(Math.min(from, to), Math.max(from, to) + 1)
                .map((entry) => entry.itemId)
                .filter((id) => isEnabled(draft, draft.item(id)));
            return ok({ selectedItemIds: select(draft, range) });
        }
        setAnchor(draft, item.id);
        return ok({ selectedItemIds: select(draft, [item.id]) });
    },
});

export const treeSelect = defineCommand({
    name: "tree.select",
    description:
        "Replace the selection with these items (at most one in single mode). Refused when one is disabled, or when the selection mode is none.",
    payloadSchema: {
        type: "object",
        properties: {
            itemIds: { ...idListSchema, description: "the items to select" },
        },
        required: ["itemIds"],
        additionalProperties: false,
    },
    resultSchema: selectionResult,
    transient: false,
    reduce: (payload, { draft }) => {
        const refused = selectable(draft);
        if (refused) return refused;
        if (
            modeOf(draftSlice(draft)) === "single" &&
            payload.itemIds.length > 1
        ) {
            return fail(
                "refused",
                'the selection mode is "single": select at most one item',
                "/itemIds",
            );
        }
        for (const [i, id] of payload.itemIds.entries()) {
            const item = requireEnabled(
                draft,
                id,
                "be selected",
                `/itemIds/${i}`,
            );
            if (isFailure(item)) return item;
        }
        const last = payload.itemIds.at(-1);
        if (last !== undefined) setAnchor(draft, last);
        return ok({ selectedItemIds: select(draft, payload.itemIds) });
    },
});

export const treeSelectAll = defineCommand({
    name: "tree.select-all",
    description:
        "Select every visible item that is not disabled (Ctrl+A). Refused unless the selection mode is multiple.",
    payloadSchema: noPayload,
    resultSchema: selectionResult,
    transient: false,
    reduce: (_payload, { draft }) => {
        const mode = modeOf(draftSlice(draft));
        if (mode !== "multiple") {
            return fail(
                "refused",
                `the selection mode is "${mode}": only multiple selects all`,
            );
        }
        const ids = visibleItems(draft.state)
            .map((entry) => entry.itemId)
            .filter((id) => isEnabled(draft, draft.item(id)));
        return ok({ selectedItemIds: select(draft, ids) });
    },
});

export const treeClearSelection = defineCommand({
    name: "tree.clear-selection",
    description: "Select nothing: the selection and its anchor are cleared.",
    payloadSchema: noPayload,
    resultSchema: selectionResult,
    transient: false,
    reduce: (_payload, { draft }) => {
        setAnchor(draft, null);
        return ok({ selectedItemIds: select(draft, []) });
    },
});
