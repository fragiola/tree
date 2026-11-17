import { type TreeModel, veto } from "@fragiola/tree-angular";
import type { FileTypes } from "../_kit/data";

/**
 * The app's naming rules, as a middleware: it sees every `item.rename` (from the input, a script,
 * an assistant) before it applies, trims the label, and vetoes a name the folder cannot take.
 */
export function namingRules(model: TreeModel<FileTypes>) {
    return model.use((ctx, next) => {
        if (ctx.command !== "item.rename") return next();
        const label = ctx.payload.label.trim();
        if (label === "") return veto("A name cannot be empty.");
        if (label.includes("/")) return veto("A name cannot contain “/”.");
        const parent = ctx.get("item-parent-by", {
            itemId: ctx.payload.itemId,
        });
        const siblingIds = parent
            ? (parent.childItemIds ?? [])
            : ctx.state.rootItemIds;
        const taken = siblingIds.some(
            (id) =>
                id !== ctx.payload.itemId &&
                ctx.get("item-by", { id })?.label.toLowerCase() ===
                    label.toLowerCase(),
        );
        if (taken) return veto(`“${label}” is already in this folder.`);
        // a rewrite: the trimmed label is what gets saved
        ctx.payload = { ...ctx.payload, label };
        return next();
    });
}
