// The focused item: `item.focus`, the roving tab stop of the tree.
import { isVisible } from "../state/structure";
import { defineCommand, fail, ok } from "./define";
import { itemIdPayload, itemIdResult } from "./expansion";
import { isFailure, requireItem } from "./rules";

export const itemFocus = defineCommand({
    name: "item.focus",
    description:
        "Make an item the tree's focused item: the roving tab stop, the one item with tabindex 0 (moving DOM focus is the engine's `focus` action). Disabled items can be focused. Refused for an item that is not visible (an ancestor is collapsed).",
    payloadSchema: itemIdPayload,
    resultSchema: itemIdResult,
    transient: false,
    reduce: (payload, { draft }) => {
        const item = requireItem(draft, payload.itemId);
        if (isFailure(item)) return item;
        if (!isVisible(draft.state, item.id)) {
            return fail(
                "refused",
                `"${item.id}" is not visible: expand its ancestors first`,
                "/itemId",
            );
        }
        draft.set("focusedItemId", item.id);
        return ok({ itemId: item.id });
    },
});
