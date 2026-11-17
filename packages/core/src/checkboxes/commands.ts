// Tri-state checkboxes: `item.check` and `item.toggle-check`. In cascade mode (the default) an
// item's descendants follow it and its ancestors are recomputed; in independent mode only the item
// changes (state.ts).
import { defineCommand, ok } from "../commands/define";
import { itemIdPayload } from "../commands/expansion";
import { isFailure, requireEnabled } from "../commands/rules";
import { idListSchema } from "../schema/tree";
import { checkedOf, checkStateOf, setChecked } from "./state";

export const itemCheck = defineCommand({
    name: "item.check",
    description:
        "Check or uncheck an item's checkbox. In cascade mode its loaded descendants follow it and its ancestors are recomputed (checked when all their children are, mixed when some are); children loaded later inherit a checked parent. In independent mode only the item changes. Refused for a disabled item.",
    payloadSchema: {
        type: "object",
        properties: {
            itemId: { type: "string", minLength: 1, description: "the item" },
            checked: {
                type: "boolean",
                description: "true checks it, false unchecks it",
            },
        },
        required: ["itemId", "checked"],
        additionalProperties: false,
    },
    resultSchema: {
        type: "object",
        properties: {
            checkedItemIds: {
                ...idListSchema,
                description: "the checked items after the command",
            },
        },
        required: ["checkedItemIds"],
        additionalProperties: false,
    },
    transient: false,
    reduce: (payload, { draft }) => {
        const item = requireEnabled(draft, payload.itemId, "be checked");
        if (isFailure(item)) return item;
        setChecked(draft, item.id, payload.checked);
        return ok({ checkedItemIds: [...checkedOf(draft.state)] });
    },
});

export const itemToggleCheck = defineCommand({
    name: "item.toggle-check",
    description:
        "Toggle an item's checkbox: a checked item is unchecked, an unchecked or mixed one is checked (with the cascade of `item.check`). Refused for a disabled item.",
    payloadSchema: itemIdPayload,
    resultSchema: {
        type: "object",
        properties: {
            itemId: { type: "string", description: "the item" },
            checked: {
                type: "boolean",
                description: "whether the item is now checked",
            },
        },
        required: ["itemId", "checked"],
        additionalProperties: false,
    },
    transient: false,
    reduce: (payload, { draft }) => {
        const item = requireEnabled(draft, payload.itemId, "be checked");
        if (isFailure(item)) return item;
        const checked = checkStateOf(draft.state, item.id) !== "checked";
        setChecked(draft, item.id, checked);
        return ok({ itemId: item.id, checked });
    },
});
