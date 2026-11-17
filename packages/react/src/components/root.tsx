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
import * as React from "react";
import { eraseModel, TreeContext, type TreeContextValue } from "../context";
import { setTreeRef, type TreeRef } from "../hooks/create-tree-ref";
import {
    type ControlledProps,
    useControlledState,
    useIsomorphicLayoutEffect,
} from "../hooks/internal";
import { createEngineFacade } from "../utils/engine-facade";
import { selectionModeOf } from "../utils/feature-state";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "../utils/use-render";

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
    extends DivPrimitiveProps<RootState> {
    /**
     * the tree model. Its middleware (`model.use`) sees every command the tree runs, and its
     * listeners (`model.subscribe`) every change. A new model identity creates a new engine. Give
     * either `model` or `defaultTree`
     */
    model?: TreeModel<T> | undefined;
    /** the document of a model the root creates and keeps (read once, at mount) */
    defaultTree?: TreeJson<T> | undefined;
    /**
     * the opt-in features of the model the root creates from `defaultTree` (read once, at mount):
     * `[selection(), virtualization({ rowSize: 28 })]`. A `model` has its own
     */
    features?: TreeFeatures | undefined;
    /** controlled expansion: the expanded items (with `onExpandedItemIdsChange`) */
    expandedItemIds?: readonly string[] | undefined;
    /** called with the expanded items after every command that changes them */
    onExpandedItemIdsChange?: ((itemIds: string[]) => void) | undefined;
    /** controlled selection: the selected items (with `onSelectedItemIdsChange`) */
    selectedItemIds?: readonly string[] | undefined;
    /** called with the selection after every command that changes it */
    onSelectedItemIdsChange?: ((itemIds: string[]) => void) | undefined;
    /** controlled checkboxes: the checked items (with `onCheckedItemIdsChange`) */
    checkedItemIds?: readonly string[] | undefined;
    /** called with the checked items after every command that changes them */
    onCheckedItemIdsChange?: ((itemIds: string[]) => void) | undefined;
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
     * runs your commands. Create it once (at module level, or memoized): another one creates
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
    children?: React.ReactNode;
}

const noSubscribe = () => () => {};
const noRevision = () => 0;

/**
 * The tree (`role="tree"`): owns the engine of its model, attaches it to the rendered element,
 * forwards the keys to it and re-renders when the tree changes. It renders only its children; no
 * Provider is needed above it.
 */
export function Root<T extends TreeTypes = AnyTypes>(props: RootProps<T>) {
    const {
        model: modelProp,
        defaultTree,
        features,
        expandedItemIds,
        onExpandedItemIdsChange,
        selectedItemIds,
        onSelectedItemIdsChange,
        checkedItemIds,
        onCheckedItemIdsChange,
        loadChildren,
        announce,
        keyMap,
        expandOnClick,
        checkboxes,
        dragThreshold,
        autoExpandDelay,
        indentation,
        indicatorInset,
        typeAheadTimeout,
        dragGroup,
        transfer,
        foreignDrop,
        dropOutside,
        treeRef,
        children,
        ...rest
    } = props;
    const [ownModel] = React.useState(() =>
        modelProp
            ? null
            : (createTreeModel<T, TreeFeatures>(defaultTree, {
                  features,
              }) as unknown as TreeModel<T>),
    );
    const typed = (modelProp ?? ownModel) as TreeModel<T>;
    // the parts below work on the erased registry; the typed surface is their props
    const model = eraseModel(typed);

    // the callbacks are read when called: a new function each render recreates nothing
    const latest = React.useRef({ loadChildren, announce, transfer });
    latest.current = { loadChildren, announce, transfer };
    const hasLoader = loadChildren !== undefined;
    const hasTransfer = transfer !== undefined;
    const keyMapKey = JSON.stringify(keyMap ?? null);

    const [facade] = React.useState(createEngineFacade);
    const [engine, setEngine] = React.useState<TreeEngine | null>(null);
    // the engine is created once mounted, in the commit (StrictMode's second mount creates a new
    // one), so no render ever starts a load or subscribes to the model
    useIsomorphicLayoutEffect(() => {
        const created = createTreeEngine(model, {
            loadChildren: hasLoader
                ? (item, context) => {
                      const load = latest.current.loadChildren as
                          | LoadChildren
                          | undefined;
                      return load
                          ? load(item, context)
                          : Promise.reject(new Error("no loadChildren"));
                  }
                : undefined,
            announce: (event) => latest.current.announce?.(event),
            keyMap,
            expandOnClick,
            checkboxes,
            dragThreshold,
            autoExpandDelay,
            indentation,
            indicatorInset,
            typeAheadTimeout,
            dragGroup,
            transfer: hasTransfer
                ? (event) => latest.current.transfer?.(event)
                : undefined,
            foreignDrop: foreignDrop as TreeForeignDrop | undefined,
            dropOutside: dropOutside as TreeDropOutside | undefined,
            // a remount (StrictMode, a route change) loads what this engine was loading
            resetLoadsOnDestroy: true,
        });
        setEngine(created);
        facade.set(created);
        return () => {
            facade.set(null);
            created.destroy();
        };
    }, [
        model,
        facade,
        hasLoader,
        keyMapKey,
        expandOnClick,
        checkboxes,
        dragThreshold,
        autoExpandDelay,
        indentation,
        indicatorInset,
        typeAheadTimeout,
        dragGroup,
        hasTransfer,
        foreignDrop,
        dropOutside,
    ]);
    // a destroyed engine (StrictMode's first mount, a replaced model) is never used again
    const live = engine && engine.adapter.model === model ? engine : null;

    useIsomorphicLayoutEffect(() => {
        if (!treeRef) return;
        setTreeRef(treeRef, {
            model: typed,
            engine: facade.engine as unknown as TreeEngine<T>,
        });
        return () => setTreeRef(treeRef, null);
    }, [treeRef, typed, facade]);

    const controlled: ControlledProps = {
        expandedItemIds,
        onExpandedItemIdsChange,
        selectedItemIds,
        onSelectedItemIdsChange,
        checkedItemIds,
        onCheckedItemIdsChange,
    };
    useControlledState(model, controlled);

    const subscribeModel = React.useCallback(
        (onChange: () => void) => model.subscribe(() => onChange()),
        [model],
    );
    const getState = () => model.state;
    const state = React.useSyncExternalStore(
        subscribeModel,
        getState,
        getState,
    );
    const revision = React.useSyncExternalStore(
        live ? live.adapter.subscribe : noSubscribe,
        live ? live.adapter.getSnapshot : noRevision,
        noRevision,
    );

    const rootRef = React.useCallback(
        (element: HTMLElement | null) => {
            if (!element || !live) return;
            live.adapter.attachRoot(element);
            return () => live.adapter.detachRoot();
        },
        [live],
    );
    const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
        live?.adapter.handleKeyDown(event);
    };
    // native drags bring foreign content (`foreignDrop`); the engine ignores them without it
    const onDrag = (event: React.DragEvent<HTMLElement>) => {
        live?.adapter.handleDragEvent(event.nativeEvent);
    };

    // biome-ignore lint/correctness/useExhaustiveDependencies: the tab stop is the state's
    const tabStopItemId = React.useMemo(
        () => model.get("tab-stop-item")?.id,
        [model, state],
    );
    const isCheckboxes = checkboxes === true;
    const context = React.useMemo<TreeContextValue>(
        () => ({
            model,
            engine: live,
            publicEngine: facade.engine,
            state,
            revision,
            tabStopItemId,
            checkboxes: isCheckboxes,
        }),
        [model, live, facade, state, revision, tabStopItemId, isCheckboxes],
    );

    const rootState: RootState = {
        multiselectable: selectionModeOf(state) === "multiple",
        dragging: live?.is("dragging") ?? false,
        keyboardDragging: live?.is("keyboard-dragging") ?? false,
        draggingFromOtherTree: live?.is("dragging-from-other-tree") ?? false,
        empty: state.rootItemIds.length === 0,
    };
    const element = useRenderElement("div", rest, {
        state: rootState,
        ref: rootRef,
        props: {
            role: "tree",
            "aria-multiselectable": rootState.multiselectable || undefined,
            "data-tree-part": "root",
            ...dataAttributes({
                dragging: rootState.dragging,
                "keyboard-dragging": rootState.keyboardDragging,
                "dragging-from-other-tree": rootState.draggingFromOtherTree,
                empty: rootState.empty,
            }),
            onKeyDown,
            onDragEnter: onDrag,
            onDragOver: onDrag,
            onDragLeave: onDrag,
            onDrop: onDrag,
            children,
        },
        // the containing block the drop indicator is positioned in
        style: { position: "relative" },
    });
    return (
        <TreeContext.Provider value={context}>{element}</TreeContext.Provider>
    );
}
