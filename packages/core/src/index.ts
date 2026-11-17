// The public entry of @fragiola/tree.

export type {
    AddPlacement,
    BatchEntry,
    BatchStep,
    CommandContext,
    CommandContextBase,
    CommandContextGetKey,
    CommandContextGetMap,
    CommandError,
    CommandErrorCode,
    CommandEvent,
    CommandInfo,
    CommandListener,
    CommandMap,
    CommandName,
    CommandResult,
    ItemSetDataPayload,
    ItemSetFlagsPayload,
    Middleware,
    MovePlacement,
    NoPayload,
    PayloadOf,
    ResultOf,
    RunOptions,
    SelectMode,
    TreeSettingsPatch,
} from "./commands/types";
export { veto } from "./commands/types";
export type { FromSchema } from "./schema/from-schema";
export { treeSchema } from "./schema/tree";
export type {
    JsonSchema,
    JsonSchemaType,
    JsonValue,
    ValidationIssue,
} from "./schema/types";
export type { CreateId } from "./state/ids";
export type {
    DataField,
    TreeItemInit,
    TreeItemJson,
    TreeJson,
    TreeSettingsJson,
} from "./state/json";
export { TreeValidationError, validateTree } from "./state/load";
export {
    createTreeModel,
    type DispatchOptions,
    type TreeModel,
    type TreeModelOptions,
} from "./state/model";
export type {
    ModelGetKey,
    ModelGetMap,
    ModelGetPayload,
    ModelGetResult,
    ModelIsKey,
    ModelIsMap,
    ModelIsPayload,
    QueryArgs,
} from "./state/queries";
export {
    type AnyTypes,
    type CheckMode,
    type CheckState,
    type ChildrenStatus,
    type DataOf,
    DEFAULT_SETTINGS,
    type ItemFlags,
    type ItemOf,
    type KindOf,
    type SelectionMode,
    type TreeItem,
    type TreeSettings,
    type TreeState,
    type TreeTypes,
    type VisibleItem,
} from "./state/types";
