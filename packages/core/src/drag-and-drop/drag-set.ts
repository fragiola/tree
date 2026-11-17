// What a drag from an item carries: the selection when the item is in it (`selection()`), else the
// item alone. Read through a key, so the drag never imports the selection feature.
import type { FeatureModel } from "../features/types";
import type { TreeModel } from "../state/model";
import type { TreeItem } from "../state/types";

export function dragSetOf(model: TreeModel, itemId: string): string[] {
    const selected = (model as unknown as FeatureModel).get("selected-items") as
        | readonly TreeItem[]
        | undefined;
    const ids = (selected ?? []).map((item) => item.id);
    return ids.includes(itemId) ? ids : [itemId];
}
