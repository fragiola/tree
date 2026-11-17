import type {
    AnyTypes,
    ItemOf,
    TreeJson,
    TreeModel,
    TreeTypes,
    VirtualRow,
} from "@fragiola/tree";

/**
 * What types a template directive's context: nothing (`<ng-template treeItems let-item>`, any
 * registry), or the model or the document (`<ng-template [treeItems]="model" let-item>`), whose
 * registry types the items it hands to the template (`item.data` narrows on `item.kind`).
 */
export type TypedBy<T extends TreeTypes> =
    | TreeModel<T>
    | TreeJson<T>
    | ""
    | undefined;

/** The context of an `<ng-template treeItems>`: the item to render. */
export interface TreeItemsContext<T extends TreeTypes = AnyTypes> {
    /** the item (`let-item`), as the model holds it (plain, immutable) */
    $implicit: ItemOf<T>;
    /** the same item (`let-item="item"`) */
    item: ItemOf<T>;
}

/** The context of an `<ng-template treeVirtualItems>`: the item to render, and its row. */
export interface TreeVirtualItemsContext<T extends TreeTypes = AnyTypes> {
    /** the item (`let-item`), as the model holds it (plain, immutable) */
    $implicit: ItemOf<T>;
    /** the same item (`let-item="item"`) */
    item: ItemOf<T>;
    /** its row (`let-row="row"`): its level, offset and size */
    row: VirtualRow;
}
