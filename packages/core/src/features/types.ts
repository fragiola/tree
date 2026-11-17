// The contract of an opt-in feature: a plain object the app passes to `createTreeModel` (or a root's
// `features` prop), made by a factory exported from the feature's own entry
// (`@fragiola/tree/selection` → `selection()`). Every part is optional; the core composes them once,
// when the model (or an engine on it) is created. Features talk to each other only through keys.
import type { CommandDefinition } from "../commands/define";
import type { CommandName, CommandResult, RunOptions } from "../commands/types";
import type { Scheduler } from "../dom/owner";
import type { KeyEventInput, PressInput } from "../engine/adapter";
import type { AnnounceEvent } from "../engine/host";
import type { LoadChildren } from "../engine/load-children";
import type {
    EngineActionKey,
    EngineGetKey,
    EngineIsKey,
} from "../engine/verbs";
import type { KeyAction } from "../keyboard/key-map";
import type { ValidationIssue } from "../schema/types";
import type { Draft } from "../state/draft";
import type { ModelGetKey, ModelIsKey } from "../state/queries";
import type {
    AnyTypes,
    TreeItem,
    TreeSettings,
    TreeState,
    TreeTypes,
    VisibleItem,
} from "../state/types";
import type { ScrollAlign } from "../virtual/scroll-target";
import type { FeatureName, OwnedBy } from "./keys";

export type { FeatureName } from "./keys";

/** A document as a feature reads it: it matched the document's JSON Schema. */
export type FeatureDocument = Readonly<Record<string, unknown>> & {
    readonly settings?: Readonly<Record<string, unknown>>;
};

/** What a feature's document rules may ask. */
export interface FeatureDocumentContext {
    /** a JSON pointer under the document's place (a `tree.load` puts it under `/json`) */
    at(path: string): string;
    /** whether the document has an item with this id */
    has(id: string): boolean;
}

/** A state as a feature sees it: the core's, with every installed feature's fields. */
export type FeatureState = TreeState & Readonly<Record<string, unknown>>;

/**
 * A model's root prop a feature ships: a controlled list of item ids (`selectedItemIds`) and its
 * change callback (`onSelectedItemIdsChange`). Adapters map it the same way, whatever the feature.
 */
export interface TreeRootProp {
    /** the prop's name (`selectedItemIds`); Vue binds it as `v-model:<kebab-case name>` */
    readonly prop: string;
    /** the change callback's name (`onSelectedItemIdsChange`) */
    readonly changeProp: string;
    /** the list the prop controls, in a state */
    read(state: FeatureState): readonly string[];
    /** runs the commands that bring the model to `itemIds` (ids the tree does not have are dropped) */
    sync(
        model: FeatureModel,
        itemIds: readonly string[],
        options: RunOptions,
    ): void;
}

/** The part of a model a feature's engine and root props use (the verbs, typed loosely). */
export interface FeatureModel {
    readonly state: FeatureState;
    run(
        command: CommandName,
        payload: object,
        options?: RunOptions,
    ): CommandResult<unknown>;
    can(command: CommandName, payload: object): boolean;
    check(command: CommandName, payload: object): CommandResult<unknown>;
    get(key: ModelGetKey, payload?: object): unknown;
    is(key: ModelIsKey, payload: object): boolean;
}

/** What an engine gives its features. */
export interface FeatureEngineHost {
    readonly model: FeatureModel;
    /** the root element, once attached */
    root(): HTMLElement | undefined;
    /** the content element of an item, once rendered */
    contentOf(itemId: string): HTMLElement | undefined;
    /** the visible items, in render order */
    visible(): readonly VisibleItem[];
    /** each visible item's index */
    visibleIndex(): ReadonlyMap<string, number>;
    /** the items whose rows stay rendered wherever the scroll is (the tab stop, a rename, a press) */
    pinnedItemIds(): readonly (string | null | undefined)[];
    /** the engine's own state changed (adapters re-render) */
    changed(): void;
    /** moves the roving tab stop and DOM focus to an item; false when it cannot */
    focus(itemId: string): boolean;
    /** gives DOM focus to an item's element (the roving tab stop stays where the model has it) */
    focusElement(itemId: string): void;
    /** the element of an item, once rendered */
    itemElement(itemId: string): HTMLElement | undefined;
    /** the roving tab stop: the item the keys act on */
    current(): string | undefined;
    /** the root window's timers */
    scheduler(): Scheduler;
    /** hands an event to the app's `announce` (the live region's text) */
    announce(event: AnnounceEvent): void;
    /** whether the engine was destroyed */
    isDestroyed(): boolean;
    /** the options the engine was created with (`loadChildren`, `resetLoadsOnDestroy`, …) */
    readonly options: Readonly<Record<string, unknown>>;
    /** the root's writing direction */
    direction(): "ltr" | "rtl";
    /** the feature that renders only some rows (virtualization), if one is installed */
    viewport(): FeatureViewport | undefined;
    /**
     * a value the features of this engine share, made by the first one that asks (the drag
     * features' session): features share state through it without importing each other
     */
    shared<V>(key: string, create: () => V): V;
}

/** What a key action sees: the focused item and its place among the visible items. */
export interface FeatureKeyContext {
    /** the roving tab stop */
    readonly current: string;
    readonly visible: readonly VisibleItem[];
    /** the index of `current` among `visible` */
    readonly at: number;
}

/**
 * What a feature's view needs from the engine when it renders only some rows (virtualization): the
 * engine asks it before focusing, scrolling or dragging over a row that may not be rendered.
 */
export interface FeatureViewport {
    attach(root: HTMLElement): void;
    detach(): void;
    /** an item's element was rendered (or removed: `null`) */
    observe(itemId: string, element: HTMLElement | null): void;
    /** scrolls an item's row into view; false when it is not a visible item */
    reveal(itemId: string, align?: ScrollAlign): boolean;
    /** the rows rendered now, as indexes of the visible items */
    rendered(): { readonly start: number; readonly end: number };
    /** where a row that is not rendered is, relative to the scroll element's content */
    unrenderedRowBox(
        itemId: string,
    ): { top: number; height: number } | undefined;
    scrollElement(): HTMLElement | undefined;
    /** how many rows a page (PageDown) moves */
    pageRows(): number;
    destroy(): void;
}

/** What a feature adds to one engine (each engine on a model gets its own). */
export interface FeatureEngine {
    /**
     * a key's action, asked before every feature's `keyAction` (checkboxes take Space before the
     * selection does): true when it did something, undefined when not its own
     */
    firstKeyAction?(
        action: KeyAction,
        context: FeatureKeyContext,
    ): boolean | undefined;
    /** a key's action on the focused item: true when it did something, undefined when not its own */
    keyAction?(
        action: KeyAction,
        context: FeatureKeyContext,
    ): boolean | undefined;
    /** a key no action is bound to (a typed character): true when it used it */
    unboundKey?(event: KeyEventInput): boolean | undefined;
    /** a bound key did something, or the root went away: what a sequence of keys holds ends */
    keysReset?(): void;
    /**
     * the model changed, before the adapters re-render (every change, wherever DOM focus is): true
     * when DOM focus, inside the tree in `active` (undefined when it is outside), must go back to
     * the focused item (an editor of the feature's goes away)
     */
    modelChanged?(active: Element | undefined): boolean;
    /** the model changed and the adapters re-rendered (and once when the engine is created) */
    settled?(): void;
    /** an item whose row stays rendered wherever the scroll is (the renaming item) */
    pinnedItemId?(): string | null | undefined;
    /** a click on an item's content, after the engine focused it */
    click?(itemId: string, event: PressInput): void;
    /** a pointer pressed an item's content element (a drag may start) */
    press?(itemId: string, event: PointerEvent, content: HTMLElement): void;
    /** whether the click that follows a press is not one (a drag's release): true swallows it */
    consumeClick?(): boolean;
    /**
     * a key on the tree, before the key map is asked: true when the feature used it, false when
     * the tree must leave it alone (a pointer drag under way), undefined when it is not its own
     */
    interceptKey?(event: KeyEventInput): boolean | undefined;
    /** a native drag event on the root (`dragenter`, `dragover`, `dragleave`, `drop`) */
    nativeDrag?(event: DragEvent): void;
    /** the root element was attached */
    attached?(root: HTMLElement): void;
    /** the root goes away, or the engine is destroyed: what is under way (a drag) ends */
    detached?(): void;
    /** engine actions (`engine.run`), each with its dry run */
    readonly run?: {
        readonly [key: string]: (
            payload: unknown,
            dryRun: boolean,
        ) => CommandResult<unknown>;
    };
    /** engine reads (`engine.get`) */
    readonly get?: { readonly [key: string]: (payload: unknown) => unknown };
    /** engine questions (`engine.is`) */
    readonly is?: { readonly [key: string]: (payload: unknown) => boolean };
    /** renders only some rows: the engine scrolls through it */
    readonly viewport?: FeatureViewport;
    destroy?(): void;
}

/**
 * An opt-in feature: its state slice, commands, keys and engine behaviour. `S` types its state
 * slice on `model.state`, and `P` the root props it ships (types only: a feature has no `~state`
 * or `~props` value).
 */
export interface TreeFeature<
    N extends FeatureName = FeatureName,
    S extends object = object,
    P extends object = object,
> {
    readonly name: N;
    /** features it needs installed too; a missing one fails `createTreeModel` */
    readonly requires?: readonly FeatureName[];
    /** its settings and their defaults (`selectionMode: "single"`) */
    readonly settings?: Readonly<Record<string, unknown>>;
    /** the rules of its document fields past the JSON Schema (references, limits) */
    issues?(
        json: FeatureDocument,
        context: FeatureDocumentContext,
    ): ValidationIssue[];
    /** its state fields, built from a valid document and the loaded items and settings */
    load?(
        json: FeatureDocument,
        items: { readonly [id: string]: TreeItem },
        settings: TreeSettings & Readonly<Record<string, unknown>>,
    ): Readonly<Record<string, unknown>>;
    /** its document fields, from a state */
    toJson?(state: FeatureState): Record<string, unknown>;
    /** its commands, on the same bus as the core's */
    readonly commands?: readonly CommandDefinition[];
    /** its `model.get` keys */
    readonly get?: {
        readonly [key: string]: (
            state: FeatureState,
            payload: never,
        ) => unknown;
    };
    /** its `model.is` keys */
    readonly is?: {
        readonly [key: string]: (
            state: FeatureState,
            payload: never,
        ) => boolean;
    };
    /** items left the tree (a removal, a reload): its lists forget them */
    forget?(draft: Draft, removed: ReadonlySet<string>): void;
    /** an item became disabled */
    disabled?(draft: Draft, itemId: string): void;
    /** the settings changed (`tree.configure`) */
    configured?(draft: Draft, before: FeatureState["settings"]): void;
    /** a document was loaded into the draft (`createTreeModel`, `tree.load`): its fields made consistent */
    loaded?(draft: Draft): void;
    /**
     * a parent's children changed (`null`: the root items): `addedItemIds` were added under it
     * (an add, loaded children), none when some left or moved
     */
    childrenChanged?(
        draft: Draft,
        parentItemId: string | null,
        addedItemIds: readonly string[],
    ): void;
    /** an item's flags changed (`item.set-flags`) */
    flagsChanged?(draft: Draft, itemId: string): void;
    /** the items that take the roving tab stop before the first visible item */
    tabStop?(state: FeatureState): readonly string[];
    /**
     * the ARIA and `data-*` an item gets, from the state alone (no screen: a server render has
     * them); `undefined` for an absent attribute
     */
    itemAttributes?(
        state: FeatureState,
        itemId: string,
    ): Readonly<Record<string, string | undefined>>;
    /** the ARIA and `data-*` the root gets, from the state alone */
    rootAttributes?(
        state: FeatureState,
    ): Readonly<Record<string, string | undefined>>;
    /** its part of each engine */
    engine?(host: FeatureEngineHost): FeatureEngine;
    /** its controlled root props */
    readonly rootProps?: readonly TreeRootProp[];
    /** the state slice's type, for `model.state` (never set) */
    readonly "~state"?: S;
    /** the root props' types, for the adapters' roots (never set) */
    readonly "~props"?: P;
}

/** Any feature. */
export type AnyTreeFeature = TreeFeature<FeatureName, object, object>;

/** A list of features, as `createTreeModel` takes it. */
export type TreeFeatures = readonly AnyTreeFeature[];

/** Every feature: what code that works on any model (an adapter) types its model with. */
export type AnyFeatures = readonly AnyTreeFeature[];

/** The names of the features of a list. */
export type FeatureNamesOf<F extends TreeFeatures> = F[number]["name"];

/** The state slices of a list of features, merged. */
export type FeatureStateOf<F extends TreeFeatures> = UnionToIntersection<
    F[number] extends infer X
        ? X extends TreeFeature<FeatureName, infer S>
            ? keyof S extends never
                ? Record<never, never>
                : S
            : never
        : never
>;

type MergedRootProps<F extends TreeFeatures> = UnionToIntersection<
    F[number] extends infer X
        ? X extends TreeFeature<FeatureName, object, infer P>
            ? keyof P extends never
                ? Record<never, never>
                : P
            : never
        : never
>;

/**
 * The root props of a list of features, merged (`selectedItemIds` with `selection()`), typed by the
 * registry `T` where a prop takes the app's items (`loadChildren` with `asyncChildren()`).
 */
export type FeatureRootPropsOf<
    F extends TreeFeatures,
    T extends TreeTypes = AnyTypes,
> =
    "async-children" extends FeatureNamesOf<F>
        ? Omit<MergedRootProps<F>, "loadChildren"> & {
              /** the app's loader of the children of an item with a `childrenStatus` */
              loadChildren?: LoadChildren<T> | undefined;
          }
        : MergedRootProps<F>;

type UnionToIntersection<U> = (
    U extends unknown
        ? (x: U) => void
        : never
) extends (x: infer I) => void
    ? I
    : never;

/** The state of a model with the features `F`. */
export type TreeStateOf<
    T extends TreeTypes = AnyTypes,
    F extends TreeFeatures = readonly [],
> = TreeState<T> & FeatureStateOf<F>;

type Allowed<
    Kind extends
        | "commands"
        | "get"
        | "is"
        | "engineRun"
        | "engineGet"
        | "engineIs",
    All extends string,
    F extends TreeFeatures,
> =
    | Exclude<All, OwnedBy<Kind>>
    | Extract<All, OwnedBy<Kind, FeatureNamesOf<F>>>;

/** The commands a model with the features `F` runs: the core's and theirs. */
export type CommandNameOf<F extends TreeFeatures> = Allowed<
    "commands",
    CommandName,
    F
>;
/** The `model.get` keys of a model with the features `F`. */
export type ModelGetKeyOf<F extends TreeFeatures> = Allowed<
    "get",
    ModelGetKey,
    F
>;
/** The `model.is` keys of a model with the features `F`. */
export type ModelIsKeyOf<F extends TreeFeatures> = Allowed<"is", ModelIsKey, F>;
/** The engine actions of an engine whose model has the features `F`. */
export type EngineActionKeyOf<F extends TreeFeatures> = Allowed<
    "engineRun",
    EngineActionKey,
    F
>;
/** The `engine.get` keys of an engine whose model has the features `F`. */
export type EngineGetKeyOf<F extends TreeFeatures> = Allowed<
    "engineGet",
    EngineGetKey,
    F
>;
/** The `engine.is` keys of an engine whose model has the features `F`. */
export type EngineIsKeyOf<F extends TreeFeatures> = Allowed<
    "engineIs",
    EngineIsKey,
    F
>;

/** An installed feature as `model.get("features")` lists it. */
export interface TreeFeatureInfo {
    readonly name: FeatureName;
    /** its controlled root props, for the adapters */
    readonly rootProps: readonly TreeRootProp[];
}
