// The command catalogue's types: every command's payload and result, the bus's results, errors,
// middleware and events. Shapes from Dockable (fragiola/dockable,
// packages/core/src/commands/types.ts), same author and licence.
import type { JsonSchema, ValidationIssue } from "../schema/types";
import type { DataField, TreeItemJson, TreeJson } from "../state/json";
import type {
    AnyTypes,
    CheckMode,
    DataOf,
    ItemOf,
    KindOf,
    SelectionMode,
    TreeSettings,
    TreeState,
    TreeTypes,
} from "../state/types";

/** The payload of a command or a key that takes nothing: `{}`. */
export type NoPayload = Record<never, never>;

/** How `item.select` changes the selection. */
export type SelectMode =
    /** the item alone (the default) */
    | "replace"
    /** the item added or removed, the rest kept */
    | "toggle"
    /** the visible items from the selection anchor to the item */
    | "extend";

/** Where `item.add` puts the new item. */
export interface AddPlacement {
    /** the parent, `null` for the root */
    parentItemId: string | null;
    /** its index among the parent's children; omitted (or past the end) appends */
    index?: number;
}

/** Where `item.move` puts the items. */
export interface MovePlacement {
    /** the parent, `null` for the root */
    parentItemId: string | null;
    /**
     * the index among the parent's children as they are now, the moved items included: they are
     * placed before the child at this index (past the end appends)
     */
    index: number;
}

/** The payload of `item.set-data`: the item's whole new data, one of the registry's data types. */
export type ItemSetDataPayload<T extends TreeTypes> = {
    [K in KindOf<T>]: { itemId: string } & DataField<DataOf<T, K>>;
}[KindOf<T>];

/** A flag of `item.set-flags`: a value, or `null` to remove the item's own (the default applies). */
export interface ItemSetFlagsPayload {
    itemId: string;
    disabled?: boolean | null;
    movable?: boolean | null;
    renamable?: boolean | null;
    droppable?: boolean | null;
}

/** A patch of the tree's settings. */
export interface TreeSettingsPatch {
    selectionMode?: SelectionMode;
    checkMode?: CheckMode;
    movable?: boolean;
    renamable?: boolean;
    droppable?: boolean;
}

/** One command of a batch. */
export type BatchEntry<T extends TreeTypes = AnyTypes> = {
    [C in CommandName]: { command: C; payload: PayloadOf<T, C> };
}[CommandName];

/** Every built-in command: its payload and its result, typed by the registry `T`. */
export interface CommandMap<T extends TreeTypes = AnyTypes> {
    "item.expand": { payload: { itemId: string }; result: { itemId: string } };
    "item.collapse": {
        payload: { itemId: string };
        result: { itemId: string };
    };
    "item.toggle": {
        payload: { itemId: string };
        result: { itemId: string; expanded: boolean };
    };
    "item.expand-siblings": {
        payload: { itemId: string };
        result: { expandedItemIds: string[] };
    };
    "tree.expand-all": {
        payload: NoPayload;
        result: { expandedItemIds: string[] };
    };
    "tree.collapse-all": {
        payload: NoPayload;
        result: { collapsedItemIds: string[] };
    };
    "item.select": {
        payload: { itemId: string; mode?: SelectMode };
        result: { selectedItemIds: string[] };
    };
    "tree.select": {
        payload: { itemIds: string[] };
        result: { selectedItemIds: string[] };
    };
    "tree.select-all": {
        payload: NoPayload;
        result: { selectedItemIds: string[] };
    };
    "tree.clear-selection": {
        payload: NoPayload;
        result: { selectedItemIds: string[] };
    };
    "item.focus": { payload: { itemId: string }; result: { itemId: string } };
    "item.check": {
        payload: { itemId: string; checked: boolean };
        result: { checkedItemIds: string[] };
    };
    "item.toggle-check": {
        payload: { itemId: string };
        result: { itemId: string; checked: boolean };
    };
    "item.start-rename": {
        payload: { itemId: string };
        result: { itemId: string };
    };
    "item.rename": {
        payload: { itemId: string; label: string };
        result: { itemId: string };
    };
    "item.cancel-rename": {
        payload: { itemId: string };
        result: { itemId: string };
    };
    "item.set-children-status": {
        payload: { itemId: string; status: "loading" | "error" };
        result: { itemId: string };
    };
    "item.set-children": {
        payload: { itemId: string; items: TreeItemJson<T>[] };
        result: { itemId: string; childItemIds: string[] };
    };
    "item.reset-children": {
        payload: { itemId: string };
        result: { itemId: string; removedItemIds: string[] };
    };
    "item.add": {
        payload: { item: TreeItemJson<T>; to: AddPlacement };
        result: { itemId: string };
    };
    "item.remove": {
        payload: { itemIds: string[] };
        result: { removedItemIds: string[] };
    };
    "item.move": {
        payload: { itemIds: string[]; to: MovePlacement };
        result: { itemIds: string[] };
    };
    "item.set-data": {
        payload: ItemSetDataPayload<T>;
        result: { itemId: string };
    };
    "item.set-flags": {
        payload: ItemSetFlagsPayload;
        result: { itemId: string };
    };
    "tree.configure": {
        payload: { settings: TreeSettingsPatch };
        /** the settings: the core's, and `selectionMode` with the selection feature */
        result: { settings: TreeSettings & { selectionMode?: SelectionMode } };
    };
    "tree.load": {
        payload: { json: TreeJson<T> };
        result: { itemIds: string[] };
    };
    batch: {
        payload: { commands: BatchEntry<T>[] };
        result: { results: unknown[] };
    };
}

/** The name of a built-in command. */
export type CommandName = keyof CommandMap;

/** The payload of command `C`. */
export type PayloadOf<
    T extends TreeTypes,
    C extends CommandName,
> = CommandMap<T>[C]["payload"];

/** The result of command `C`. */
export type ResultOf<
    T extends TreeTypes,
    C extends CommandName,
> = CommandMap<T>[C]["result"];

/** Why a command did not apply. */
export type CommandErrorCode =
    /** no command has this name */
    | "unknown_command"
    /** the payload does not match the command's schema (or a data schema) */
    | "invalid_payload"
    /** an item the payload names does not exist */
    | "not_found"
    /** a rule of the tree forbids it (a permission flag, the selection mode, a cycle, …) */
    | "refused"
    /** a middleware vetoed it */
    | "vetoed"
    /** it was issued from a middleware and will run after the current command */
    | "queued"
    /** a middleware threw */
    | "middleware_error";

export interface CommandError {
    readonly code: CommandErrorCode;
    readonly message: string;
    /** a JSON pointer into the payload (or the dispatched input) */
    readonly path?: string;
    /** every schema problem, for `invalid_payload` */
    readonly issues?: readonly ValidationIssue[];
}

/** What a command returns: its value, or why it did not apply. It never throws on bad input. */
export type CommandResult<R> =
    | { readonly ok: true; readonly value: R }
    | { readonly ok: false; readonly error: CommandError };

/** Options of `run`. */
export interface RunOptions {
    /** a step of a continuous gesture: the event is marked so undo can merge it */
    transient?: boolean;
    /** free-form information for middleware and listeners (who asked, a drag's details, …) */
    meta?: Readonly<Record<string, unknown>>;
}

/** What a middleware's `ctx.get` reads: each key's payload and result, as on `model.get`. */
export interface CommandContextGetMap<T extends TreeTypes = AnyTypes> {
    /** an item by its id */
    "item-by": { payload: { id: string }; result: ItemOf<T> | undefined };
    /** an item's parent (undefined for a root item) */
    "item-parent-by": {
        payload: { itemId: string };
        result: ItemOf<T> | undefined;
    };
}

/** What a middleware's `ctx.get` reads. */
export type CommandContextGetKey = keyof CommandContextGetMap;

/** What a middleware sees of any command. */
export interface CommandContextBase<T extends TreeTypes = AnyTypes> {
    /** `model.can`/`model.check` (or a drag's hover): nothing will be committed; no side effects */
    readonly dryRun: boolean;
    readonly transient: boolean;
    /** true for a command running inside a batch (the batch itself also passes the chain) */
    readonly inBatch: boolean;
    readonly meta: Readonly<Record<string, unknown>> | undefined;
    /** the committed state the command applies to */
    readonly state: TreeState<T>;
    /** reads an item or its parent as the command sees it: inside a batch, after its earlier commands */
    get<K extends CommandContextGetKey>(
        key: K,
        payload: CommandContextGetMap<T>[K]["payload"],
    ): CommandContextGetMap<T>[K]["result"];
}

/**
 * What a middleware sees: a union discriminated by `command`, so checking the command narrows the
 * payload (`if (ctx.command === "item.move") ctx.payload.itemIds`).
 */
export type CommandContext<T extends TreeTypes = AnyTypes> = {
    [C in CommandName]: CommandContextBase<T> & {
        readonly command: C;
        /** the validated payload; assign a new object to rewrite it (it is validated again) */
        payload: PayloadOf<T, C>;
    };
}[CommandName];

/**
 * Runs around every command, engine-issued or not: veto (return an error without calling
 * `next`), rewrite (assign `ctx.payload`, then call `next`) or observe (call `next` and look at its
 * result). Returning `undefined` passes on `next`'s result when it was called.
 */
export type Middleware<T extends TreeTypes = AnyTypes> = (
    ctx: CommandContext<T>,
    next: () => CommandResult<unknown>,
) => CommandResult<unknown> | undefined;

/** One command of a batch, as its event reports it. */
export interface BatchStep {
    readonly command: CommandName;
    readonly payload: unknown;
    readonly result: unknown;
}

/** What a listener receives: one event per commit. */
export interface CommandEvent<T extends TreeTypes = AnyTypes> {
    readonly command: CommandName;
    readonly payload: unknown;
    /** the command's value */
    readonly result: unknown;
    readonly before: TreeState<T>;
    readonly after: TreeState<T>;
    readonly transient: boolean;
    readonly meta: Readonly<Record<string, unknown>> | undefined;
    /** for a batch: the commands it ran, flattened */
    readonly commands?: readonly BatchStep[];
}

export type CommandListener<T extends TreeTypes = AnyTypes> = (
    event: CommandEvent<T>,
) => void;

/** A command as `model.get("commands")` describes it: ready to become an AI tool definition. */
export interface CommandInfo {
    readonly name: CommandName;
    readonly description: string;
    readonly payloadSchema: JsonSchema;
    readonly resultSchema: JsonSchema;
    /** whether it may run as a step of a continuous gesture */
    readonly transient: boolean;
}

/** The vetoed result a middleware returns to stop a command. */
export function veto(message = "vetoed by a middleware"): {
    readonly ok: false;
    readonly error: CommandError;
} {
    return { ok: false, error: { code: "vetoed", message } };
}
