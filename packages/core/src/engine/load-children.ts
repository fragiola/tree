// The type of the app's loader of an item's children: what the `loadChildren` engine option (and
// every root's prop) takes. `asyncChildren()` (`@fragiola/tree/async-children`) calls it.
import type { TreeItemJson } from "../state/json";
import type { AnyTypes, ItemOf, TreeTypes } from "../state/types";

/** The app's loader: an item's children, as item JSON (their ids generated when omitted). */
export type LoadChildren<T extends TreeTypes = AnyTypes> = (
    item: ItemOf<T>,
    context: { readonly signal: AbortSignal },
) => Promise<readonly TreeItemJson<T>[]>;
