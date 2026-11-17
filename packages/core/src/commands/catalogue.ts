import { itemCheck, itemToggleCheck } from "./check";
import {
    itemResetChildren,
    itemSetChildren,
    itemSetChildrenStatus,
} from "./children";
import type { CommandDefinition } from "./define";
import {
    itemCollapse,
    itemExpand,
    itemExpandSiblings,
    itemToggle,
    treeCollapseAll,
    treeExpandAll,
} from "./expansion";
import {
    itemAdd,
    itemMove,
    itemRemove,
    itemSetData,
    itemSetFlags,
} from "./item";
import { itemCancelRename, itemRename, itemStartRename } from "./rename";
import {
    itemFocus,
    itemSelect,
    treeClearSelection,
    treeSelect,
    treeSelectAll,
} from "./selection";
import { batch, treeConfigure, treeLoad } from "./tree";
import type { CommandName } from "./types";

/**
 * Every built-in command, in the order `model.get("commands")` lists them. Each definition keeps its
 * schemas' literal types (the type tests read them); the list erases them to `CommandDefinition`
 * once, so code that walks it does not compare every literal schema with `JsonSchema` again.
 */
export const COMMANDS: readonly CommandDefinition[] = [
    itemExpand,
    itemCollapse,
    itemToggle,
    itemExpandSiblings,
    treeExpandAll,
    treeCollapseAll,
    itemSelect,
    treeSelect,
    treeSelectAll,
    treeClearSelection,
    itemFocus,
    itemCheck,
    itemToggleCheck,
    itemStartRename,
    itemRename,
    itemCancelRename,
    itemSetChildrenStatus,
    itemSetChildren,
    itemResetChildren,
    itemAdd,
    itemRemove,
    itemMove,
    itemSetData,
    itemSetFlags,
    treeConfigure,
    treeLoad,
    batch,
    // each entry is checked for what the list relies on (its schemas were checked where it was
    // defined), then the literal types are erased
] as const satisfies readonly {
    readonly name: CommandName;
    readonly transient: boolean;
    readonly reduce: (...args: never[]) => unknown;
}[] as readonly unknown[] as readonly CommandDefinition[];

/** The command definitions by name. */
export const COMMAND_DEFINITIONS: ReadonlyMap<string, CommandDefinition> =
    new Map(COMMANDS.map((definition) => [definition.name, definition]));
