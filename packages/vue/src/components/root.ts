import {
    type AnnounceEvent,
    type AnyTypes,
    createTreeEngine,
    createTreeModel,
    type KeyMap,
    type LoadChildren,
    type TransferHandler,
    type TreeDropOutside,
    type TreeEngine,
    type TreeFeatures,
    type TreeForeignDrop,
    type TreeJson,
    type TreeModel,
    type TreeTypes,
} from "@fragiola/tree";
import {
    computed,
    defineComponent,
    h,
    onBeforeUnmount,
    onMounted,
    provide,
    shallowRef,
    watch,
} from "vue";
import {
    setTreeRef,
    type TreeHandle,
    type TreeRef,
} from "../composables/create-tree-ref";
import { useControlledState } from "../composables/internal";
import {
    eraseModel,
    ModelKey,
    type TreeContextValue,
    TreeKey,
} from "../context";
import { createEngineFacade } from "../utils/engine-facade";
import { selectionModeOf } from "../utils/feature-state";
import {
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
    type TreeComponent,
} from "../utils/primitive";
import {
    dataAttributes,
    elementRef,
    type RenderSlot,
    renderElement,
    useExternal,
} from "../utils/render";

export interface RootState {
    /** the selection mode is `multiple` (`aria-multiselectable`) */
    multiselectable: boolean;
    /** a drag is under way (pointer or keyboard) */
    dragging: boolean;
    /** a keyboard drag is under way */
    keyboardDragging: boolean;
    /** a drag from another tree of the drag group is under way (`dragGroup`) */
    draggingFromOtherTree: boolean;
    /** the tree has no item */
    empty: boolean;
}

export interface RootProps<T extends TreeTypes = AnyTypes>
    extends PrimitiveProps {
    /**
     * the tree model. Its middleware (`model.use`) sees every command the tree runs, and its
     * listeners (`model.subscribe`) every change. Another model remounts the tree (a new engine).
     * Give either `model` or `defaultTree`
     */
    model?: TreeModel<T> | undefined;
    /** the document of a model the root creates and keeps (read once, at mount) */
    defaultTree?: TreeJson<T> | undefined;
    /**
     * the opt-in features of the model the root creates from `defaultTree` (read once, at mount):
     * `[selection(), virtualization({ rowSize: 28 })]`. A `model` has its own
     */
    features?: TreeFeatures | undefined;
    /** controlled expansion: the expanded items (`v-model:expanded-item-ids`) */
    expandedItemIds?: readonly string[] | undefined;
    /** controlled selection: the selected items (`v-model:selected-item-ids`) */
    selectedItemIds?: readonly string[] | undefined;
    /** controlled checkboxes: the checked items (`v-model:checked-item-ids`) */
    checkedItemIds?: readonly string[] | undefined;
    /** the app's loader of the children of an item with a `childrenStatus` */
    loadChildren?: LoadChildren<T> | undefined;
    /** the live region's text for a drag step or a failed load (no text is built in) */
    announce?: ((event: AnnounceEvent) => string | undefined) | undefined;
    /** the key bindings, over the defaults (`DEFAULT_KEY_MAP`) */
    keyMap?: Partial<KeyMap> | undefined;
    /** a click on a parent's content also expands or collapses it (default false) */
    expandOnClick?: boolean | undefined;
    /** the items carry `aria-checked`, and Space toggles the focused item's check (default false) */
    checkboxes?: boolean | undefined;
    /** how far (px) a press moves before it is a drag (default 4) */
    dragThreshold?: number | undefined;
    /** how long (ms) a drag hovers a collapsed parent before it expands (default 800) */
    autoExpandDelay?: number | undefined;
    /** the indentation of one level (px), for the drop level at the end of a sublist (default 16) */
    indentation?: number | undefined;
    /** how far (px) a drop line starts past its level's inline start: the toggle, a grip or padding before the label (default 0) */
    indicatorInset?: number | undefined;
    /** how long (ms) between two typed characters keeps one type-ahead search (default 500) */
    typeAheadTimeout?: number | undefined;
    /**
     * joins the trees of the document with the same group name: items drag between them, by pointer
     * and keyboard (over one model a drop is one `item.move`, over two a transfer)
     */
    dragGroup?: string | undefined;
    /**
     * what a drop from a tree of another model does here: run your commands (copy, convert kinds)
     * and return false to refuse; asked first with `dryRun` for each target. Default: the target
     * model adds the dragged subtrees and the source model removes them
     */
    transfer?: TransferHandler | undefined;
    /**
     * takes files, links and text dragged on the tree from the desktop or another window
     * (`createTreeForeignDrop(options)`): the target shows as for a tree drag, and its `onDrop`
     * runs your commands. Create it once (in `setup`, or at module level): another one creates
     * another engine
     */
    foreignDrop?: TreeForeignDrop<T> | undefined;
    /**
     * hands your `onDrop` the items of a pointer drag released outside every tree of the group
     * (`createTreeDropOutside(options)`), for your own targets. Create it once: another one
     * creates another engine
     */
    dropOutside?: TreeDropOutside<T> | undefined;
    /** access to the model and the engine from outside the root (`useTreeRef`, `createTreeRef`) */
    treeRef?: TreeRef<T> | undefined;
}

export interface RootSlots extends RenderSlot<RootState> {
    /** the tree: `Tree.Items`, `Tree.DropIndicator`, `Tree.LiveRegion`, … */
    default?: SlotFunction<Record<never, never>>;
}

/** The events of `Tree.Root`: a change of a list, for `v-model` (or `@update:…-item-ids`). */
export type RootEmits = {
    /** the expanded items, after every command that changes them */
    "update:expandedItemIds": (itemIds: string[]) => void;
    /** the selection, after every command that changes it */
    "update:selectedItemIds": (itemIds: string[]) => void;
    /** the checked items, after every command that changes them */
    "update:checkedItemIds": (itemIds: string[]) => void;
};

const ROOT_PROPS = [
    "model",
    "defaultTree",
    "features",
    "expandedItemIds",
    "selectedItemIds",
    "checkedItemIds",
    "loadChildren",
    "announce",
    "keyMap",
    "expandOnClick",
    "checkboxes",
    "dragThreshold",
    "autoExpandDelay",
    "indentation",
    "indicatorInset",
    "typeAheadTimeout",
    "dragGroup",
    "transfer",
    "foreignDrop",
    "dropOutside",
    "treeRef",
    "as",
] as const satisfies readonly (keyof RootProps)[];

/** the props a bare attribute turns on (`<Tree.Root checkboxes>`) */
const ROOT_BOOLEANS = [
    "expandOnClick",
    "checkboxes",
] as const satisfies readonly (keyof RootProps)[];

const ROOT_EMITS = [
    "update:expandedItemIds",
    "update:selectedItemIds",
    "update:checkedItemIds",
] as const satisfies readonly (keyof RootEmits)[];

/** a key per object: another model remounts the tree (`-1` for none) */
const modelKeys = new WeakMap<object, number>();
let nextModelKey = 0;
function keyOfModel(model: object | undefined): number {
    if (model === undefined) return -1;
    let key = modelKeys.get(model);
    if (key === undefined) {
        key = nextModelKey++;
        modelKeys.set(model, key);
    }
    return key;
}

/** The tree of one model: it owns the engine, so it lives as long as the model does. */
const RootTree = definePrimitive<RootProps, RootSlots, RootEmits>(
    "RootTree",
    ROOT_PROPS,
    (props, { attrs, slots, emit }) => {
        const model = eraseModel(
            props.model ??
                createTreeModel<AnyTypes, TreeFeatures>(props.defaultTree, {
                    features: props.features,
                }),
        );
        const state = useExternal(
            (listener) => model.subscribe(() => listener()),
            () => model.state,
        );

        const facade = createEngineFacade();
        const engine = shallowRef<TreeEngine | null>(null);
        const revision = shallowRef(0);
        watch(
            engine,
            (current, _previous, onCleanup) => {
                if (!current) return;
                onCleanup(
                    current.adapter.subscribe(() => {
                        revision.value++;
                    }),
                );
            },
            { flush: "sync" },
        );

        // the engine is created once mounted, so no server render starts a load or subscribes to
        // the model; an option it is created with recreates it
        const options = () => ({
            hasLoader: props.loadChildren !== undefined,
            keyMap: JSON.stringify(props.keyMap ?? null),
            expandOnClick: props.expandOnClick,
            checkboxes: props.checkboxes,
            dragThreshold: props.dragThreshold,
            autoExpandDelay: props.autoExpandDelay,
            indentation: props.indentation,
            indicatorInset: props.indicatorInset,
            typeAheadTimeout: props.typeAheadTimeout,
            dragGroup: props.dragGroup,
            hasTransfer: props.transfer !== undefined,
            foreignDrop: keyOfModel(props.foreignDrop),
            dropOutside: keyOfModel(props.dropOutside),
        });
        const create = () => {
            const hasLoader = props.loadChildren !== undefined;
            const created = createTreeEngine(model, {
                // the callbacks are read when called: a new function recreates nothing
                loadChildren: hasLoader
                    ? (item, context) => {
                          const load = props.loadChildren as
                              | LoadChildren
                              | undefined;
                          return load
                              ? load(item, context)
                              : Promise.reject(new Error("no loadChildren"));
                      }
                    : undefined,
                announce: (event) => props.announce?.(event),
                keyMap: props.keyMap,
                expandOnClick: props.expandOnClick,
                checkboxes: props.checkboxes,
                dragThreshold: props.dragThreshold,
                autoExpandDelay: props.autoExpandDelay,
                indentation: props.indentation,
                indicatorInset: props.indicatorInset,
                typeAheadTimeout: props.typeAheadTimeout,
                dragGroup: props.dragGroup,
                transfer:
                    props.transfer !== undefined
                        ? (event) => props.transfer?.(event)
                        : undefined,
                foreignDrop: props.foreignDrop as TreeForeignDrop | undefined,
                dropOutside: props.dropOutside as TreeDropOutside | undefined,
                // a remount (a route change, a `v-if`) loads what this engine was loading
                resetLoadsOnDestroy: true,
            });
            engine.value = created;
            facade.set(created);
        };
        const destroy = () => {
            const current = engine.value;
            facade.set(null);
            engine.value = null;
            current?.destroy();
        };
        let mounted = false;
        onMounted(() => {
            mounted = true;
            create();
        });
        onBeforeUnmount(() => {
            mounted = false;
            destroy();
        });
        watch(
            () => JSON.stringify(options()),
            () => {
                if (!mounted) return;
                destroy();
                create();
            },
        );

        // the tree ref: the model and the facade (the same object across engines)
        const handle: TreeHandle = { model, engine: facade.engine };
        watch(
            () => props.treeRef,
            (ref, previous) => {
                if (previous) setTreeRef(previous, null);
                if (ref && mounted) setTreeRef(ref as TreeRef, handle);
            },
        );
        onMounted(() => {
            if (props.treeRef) setTreeRef(props.treeRef as TreeRef, handle);
        });
        onBeforeUnmount(() => {
            if (props.treeRef) setTreeRef(props.treeRef as TreeRef, null);
        });

        useControlledState(model, props, (event, itemIds) =>
            emit(event, itemIds),
        );

        const context: TreeContextValue = {
            model,
            engine,
            publicEngine: facade.engine,
            state,
            revision,
            tabStopItemId: computed(() => {
                state.value;
                return model.get("tab-stop-item")?.id;
            }),
            checkboxes: computed(() => props.checkboxes === true),
        };
        provide(TreeKey, context);
        provide(ModelKey, model);

        const rootRef = elementRef(
            (element) => {
                const current = engine.value;
                if (!current) return undefined;
                current.adapter.attachRoot(element);
                return () => current.adapter.detachRoot();
            },
            () => [engine.value],
        );
        const onKeydown = (event: KeyboardEvent) => {
            engine.value?.adapter.handleKeyDown(event);
        };
        // native drags bring foreign content (`foreignDrop`); the engine ignores them without it
        const onDrag = (event: DragEvent) => {
            engine.value?.adapter.handleDragEvent(event);
        };

        return () => {
            const tree = state.value;
            revision.value;
            const live = engine.value;
            const rootState: RootState = {
                multiselectable: selectionModeOf(tree) === "multiple",
                dragging: live?.is("dragging") ?? false,
                keyboardDragging: live?.is("keyboard-dragging") ?? false,
                draggingFromOtherTree:
                    live?.is("dragging-from-other-tree") ?? false,
                empty: tree.rootItemIds.length === 0,
            };
            return renderElement({
                tag: "div",
                as: props.as,
                attrs,
                render: slots.render,
                state: rootState,
                ref: rootRef,
                props: {
                    role: "tree",
                    "aria-multiselectable":
                        rootState.multiselectable || undefined,
                    "data-tree-part": "root",
                    ...dataAttributes({
                        dragging: rootState.dragging,
                        "keyboard-dragging": rootState.keyboardDragging,
                        "dragging-from-other-tree":
                            rootState.draggingFromOtherTree,
                        empty: rootState.empty,
                    }),
                    onKeydown,
                    onDragenter: onDrag,
                    onDragover: onDrag,
                    onDragleave: onDrag,
                    onDrop: onDrag,
                },
                // the containing block the drop indicator is positioned in
                style: { position: "relative" },
                children: () => slots.default?.({}),
            });
        };
    },
    { booleans: ROOT_BOOLEANS, emits: ROOT_EMITS },
);

/**
 * The tree (`role="tree"`): owns the engine of its model, attaches it to the rendered element,
 * forwards the keys to it and re-renders when the tree changes. It renders only its default slot;
 * no provider is needed above it. Another `model` remounts the tree.
 */
export const Root: TreeComponent<RootProps, RootSlots, RootEmits> =
    defineComponent({
        name: "TreeRoot",
        inheritAttrs: false,
        // a bare boolean attribute reaches RootTree as it came, which casts it
        props: [...ROOT_PROPS],
        emits: [...ROOT_EMITS],
        setup(props, { attrs, slots, emit }) {
            const forward = Object.fromEntries(
                ROOT_EMITS.map((event) => [
                    `on${event[0]?.toUpperCase()}${event.slice(1)}`,
                    (itemIds: string[]) => emit(event, itemIds),
                ]),
            );
            return () =>
                h(
                    RootTree,
                    {
                        ...attrs,
                        ...props,
                        ...forward,
                        key: keyOfModel(props.model as object | undefined),
                    },
                    slots,
                );
        },
    }) as unknown as TreeComponent<RootProps, RootSlots, RootEmits>;
