// Type fixtures (compiled by `pnpm typecheck`, never run): each command's hand-written JSON Schema,
// read back as a type with FromSchema, is the command's payload type (and result type), and the
// document schema is `TreeJson`. A schema that drifts from its type fails the typecheck.
import type {
    itemResetChildren,
    itemSetChildren,
    itemSetChildrenStatus,
} from "../../src/async-children/commands";
import type { itemCheck, itemToggleCheck } from "../../src/checkboxes/commands";
import type {
    itemCollapse,
    itemExpand,
    itemExpandSiblings,
    itemToggle,
    treeCollapseAll,
    treeExpandAll,
} from "../../src/commands/expansion";
import type { itemFocus } from "../../src/commands/focus";
import type {
    itemAdd,
    itemMove,
    itemRemove,
    itemSetData,
    itemSetFlags,
} from "../../src/commands/item";
import type { treeConfigure, treeLoad } from "../../src/commands/tree";
import type {
    CommandName,
    PayloadOf,
    ResultOf,
} from "../../src/commands/types";
import type {
    itemCancelRename,
    itemRename,
    itemStartRename,
} from "../../src/rename/commands";
import type { FromSchema } from "../../src/schema/from-schema";
import type { treeSchema } from "../../src/schema/tree";
import type {
    itemSelect,
    treeClearSelection,
    treeSelect,
    treeSelectAll,
} from "../../src/selection/commands";
import type { TreeJson } from "../../src/state/json";
import type { AnyTypes } from "../../src/state/types";

/** Mutually assignable, with the same keys. */
type Same<A, B> = [A] extends [B]
    ? [B] extends [A]
        ? [keyof A] extends [keyof B]
            ? [keyof B] extends [keyof A]
                ? true
                : false
            : false
        : false
    : false;

type Check<
    C extends CommandName,
    D extends { payloadSchema: unknown; resultSchema: unknown },
> = [
    Same<FromSchema<D["payloadSchema"]>, PayloadOf<AnyTypes, C>>,
    Same<FromSchema<D["resultSchema"]>, ResultOf<AnyTypes, C>>,
];

/** Compiles only when every entry is `[true, true]`. `batch` is checked by its own tests. */
export type SchemasMatchTypes = [
    Check<"item.expand", typeof itemExpand>,
    Check<"item.collapse", typeof itemCollapse>,
    Check<"item.toggle", typeof itemToggle>,
    Check<"item.expand-siblings", typeof itemExpandSiblings>,
    Check<"tree.expand-all", typeof treeExpandAll>,
    Check<"tree.collapse-all", typeof treeCollapseAll>,
    Check<"item.select", typeof itemSelect>,
    Check<"tree.select", typeof treeSelect>,
    Check<"tree.select-all", typeof treeSelectAll>,
    Check<"tree.clear-selection", typeof treeClearSelection>,
    Check<"item.focus", typeof itemFocus>,
    Check<"item.check", typeof itemCheck>,
    Check<"item.toggle-check", typeof itemToggleCheck>,
    Check<"item.start-rename", typeof itemStartRename>,
    Check<"item.rename", typeof itemRename>,
    Check<"item.cancel-rename", typeof itemCancelRename>,
    Check<"item.set-children-status", typeof itemSetChildrenStatus>,
    Check<"item.set-children", typeof itemSetChildren>,
    Check<"item.reset-children", typeof itemResetChildren>,
    Check<"item.add", typeof itemAdd>,
    Check<"item.remove", typeof itemRemove>,
    Check<"item.move", typeof itemMove>,
    Check<"item.set-data", typeof itemSetData>,
    Check<"item.set-flags", typeof itemSetFlags>,
    Check<"tree.configure", typeof treeConfigure>,
    Check<"tree.load", typeof treeLoad>,
] extends [true, true][]
    ? true
    : never;

export const schemasMatchTypes: SchemasMatchTypes = true;

/** The document schema is the document type. */
export const documentSchemaMatchesType: Same<
    FromSchema<typeof treeSchema>,
    TreeJson<AnyTypes>
> = true;
