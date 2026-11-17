import {
    afterNextRender,
    computed,
    Directive,
    effect,
    inject,
    input,
    output,
    type Signal,
    signal,
    untracked,
} from "@angular/core";
import {
    type AnnounceEvent,
    type AnyTypes,
    createTreeEngine,
    createTreeModel,
    FEATURE_ROOT_PROPS,
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
    eraseModel,
    TREE_CONTEXT,
    TREE_GROUP,
    type TreeContext,
    typedEngine,
} from "../context";
import { bindControlledState } from "../utils/controlled";
import { createEngineFacade } from "../utils/engine-facade";
import {
    bindFeatureAttributes,
    bindStructuralStyle,
    dataAttr,
    fromStore,
    injectHost,
    onDestroy,
    optionalBoolean,
} from "../utils/helpers";

export interface RootState {
    /** the selection mode is `multiple` (`aria-multiselectable`, with `selection()`) */
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

/**
 * The tree (`role="tree"`): put it on the element the tree renders in,
 * `<div [treeRoot]="model" aria-label="Files">` (or `<div treeRoot [defaultTree]="json">`). It
 * owns the engine of its model, attaches it to the element, forwards the keys to it and provides
 * the tree to the parts inside. Another model, or another engine option, makes another engine.
 * `#tree="treeRoot"` gives its `model()` and its `engine` to the rest of the template.
 */
@Directive({
    selector: "[treeRoot]",
    exportAs: "treeRoot",
    providers: [
        {
            provide: TREE_CONTEXT,
            useFactory: () => inject(TreeRootDirective).context,
        },
        // a tree inside another tree's group starts at its own root items
        { provide: TREE_GROUP, useValue: null },
    ],
    host: {
        role: "tree",
        "data-tree-part": "root",
        "[attr.data-dragging]": "data().dragging",
        "[attr.data-keyboard-dragging]": "data().keyboardDragging",
        "[attr.data-dragging-from-other-tree]": "data().draggingFromOtherTree",
        "[attr.data-empty]": "data().empty",
        "(keydown)": "onKeyDown($event)",
        "(dragenter)": "onDrag($event)",
        "(dragover)": "onDrag($event)",
        "(dragleave)": "onDrag($event)",
        "(drop)": "onDrag($event)",
    },
})
export class TreeRootDirective<T extends TreeTypes = AnyTypes> {
    /**
     * the tree model. Its middleware (`model.use`) sees every command the tree runs, and its
     * listeners (`model.subscribe`) every change. Another model makes another engine. Give
     * either the model or `defaultTree`
     */
    readonly treeRoot = input<TreeModel<T> | "" | undefined>(undefined);
    /** the document of a model the root creates and keeps (read once, when first set) */
    readonly defaultTree = input<TreeJson<T> | undefined>(undefined);
    /**
     * the opt-in features of the model the root creates from `defaultTree` (read once, when it
     * creates it): `[selection(), virtualization({ rowSize: 28 })]`. A model has its own
     */
    readonly features = input<TreeFeatures | undefined>(undefined);
    /** controlled expansion: the expanded items (`[(expandedItemIds)]`) */
    readonly expandedItemIds = input<readonly string[] | undefined>(undefined);
    /**
     * controlled selection: the selected items (`[(selectedItemIds)]`), with `selection()` in the
     * model's features (without it, ignored with a warning)
     */
    readonly selectedItemIds = input<readonly string[] | undefined>(undefined);
    /** controlled checkboxes: the checked items (`[(checkedItemIds)]`) */
    readonly checkedItemIds = input<readonly string[] | undefined>(undefined);
    /** the app's loader of the children of an item with a `childrenStatus` */
    readonly loadChildren = input<LoadChildren<T> | undefined>(undefined);
    /** the live region's text for a drag step or a failed load (no text is built in) */
    readonly announce = input<
        ((event: AnnounceEvent) => string | undefined) | undefined
    >(undefined);
    /** the key bindings, over the defaults (`DEFAULT_KEY_MAP`) */
    readonly keyMap = input<Partial<KeyMap> | undefined>(undefined);
    /** a click on a parent's content also expands or collapses it (default false) */
    readonly expandOnClick = input(undefined, { transform: optionalBoolean });
    /** the items carry `aria-checked`, and Space toggles the focused item's check (default false) */
    readonly checkboxes = input(undefined, { transform: optionalBoolean });
    /** how far (px) a press moves before it is a drag (default 4) */
    readonly dragThreshold = input<number | undefined>(undefined);
    /** how long (ms) a drag hovers a collapsed parent before it expands (default 800) */
    readonly autoExpandDelay = input<number | undefined>(undefined);
    /** the indentation of one level (px), for the drop level at the end of a sublist (default 16) */
    readonly indentation = input<number | undefined>(undefined);
    /** how far (px) a drop line starts past its level's inline start: the toggle, a grip or padding before the label (default 0) */
    readonly indicatorInset = input<number | undefined>(undefined);
    /** how long (ms) between two typed characters keeps one type-ahead search (default 500) */
    readonly typeAheadTimeout = input<number | undefined>(undefined);
    /**
     * joins the trees of the document with the same group name: items drag between them, by pointer
     * and keyboard (over one model a drop is one `item.move`, over two a transfer)
     */
    readonly dragGroup = input<string | undefined>(undefined);
    /**
     * what a drop from a tree of another model does here: run your commands (copy, convert kinds)
     * and return false to refuse; asked first with `dryRun` for each target. Default: the target
     * model adds the dragged subtrees and the source model removes them
     */
    readonly transfer = input<TransferHandler | undefined>(undefined);
    /**
     * takes files, links and text dragged on the tree from the desktop or another window
     * (`createTreeForeignDrop(options)`): the target shows as for a tree drag, and its `onDrop`
     * runs your commands. Create it once (a field): another one makes another engine
     */
    readonly foreignDrop = input<TreeForeignDrop<T> | undefined>(undefined);
    /**
     * hands your `onDrop` the items of a pointer drag released outside every tree of the group
     * (`createTreeDropOutside(options)`), for your own targets. Create it once (a field): another
     * one makes another engine
     */
    readonly dropOutside = input<TreeDropOutside<T> | undefined>(undefined);

    /** the expanded items, after every command that changes them */
    readonly expandedItemIdsChange = output<string[]>();
    /** the selection, after every command that changes it */
    readonly selectedItemIdsChange = output<string[]>();
    /** the checked items, after every command that changes them */
    readonly checkedItemIdsChange = output<string[]>();

    private readonly host = injectHost();
    /** the model made from `defaultTree`, once it is set */
    private own: TreeModel | undefined;
    /** the model shown while there is neither a model nor a `defaultTree`: no item */
    private empty: TreeModel | undefined;

    /** the root's model: its `treeRoot` input, or the one it made from `defaultTree` */
    readonly model: Signal<TreeModel<T>> = computed(() => {
        const given = this.treeRoot();
        if (given) return given;
        if (!this.own) {
            const json = this.defaultTree();
            if (json === undefined) {
                this.empty ??= createTreeModel();
                return this.empty as unknown as TreeModel<T>;
            }
            this.own = eraseModel(
                createTreeModel<T, TreeFeatures>(json, {
                    features: untracked(this.features),
                }) as unknown as TreeModel<T>,
            );
        }
        return this.own as unknown as TreeModel<T>;
    });
    private readonly erased = computed(() => eraseModel(this.model()));

    private readonly facade = createEngineFacade();
    /**
     * the engine of the tree on screen, as apps see it: screen actions
     * (`engine.run("focus", { itemId })`) and screen facts (`engine.get("drop-target")`). It is
     * there from the start; before the root created its engine an action is refused and a read
     * is empty
     */
    readonly engine: TreeEngine<T> = typedEngine<T>(this.facade.engine);

    private readonly current = signal<TreeEngine | null>(null);
    private readonly tick = signal(0);
    private readonly treeState = fromStore(
        () => this.erased().subscribe,
        () => this.erased().state,
    );

    /** what the parts read: the model, the engine, the state and the revision */
    readonly context: TreeContext = {
        model: this.erased,
        engine: this.current.asReadonly(),
        publicEngine: this.facade.engine,
        state: this.treeState,
        revision: this.tick.asReadonly(),
        tabStopItemId: computed(() => {
            this.treeState();
            return this.erased().get("tab-stop-item")?.id;
        }),
        checkboxes: computed(() => this.checkboxes() === true),
    };

    /** what the root shows as ARIA and `data-*` */
    readonly state: Signal<RootState> = computed(() => {
        const tree = this.treeState();
        this.tick();
        const live = this.current();
        return {
            multiselectable:
                live?.adapter.rootAttributes()["aria-multiselectable"] ===
                "true",
            dragging: live?.is("dragging") ?? false,
            keyboardDragging: live?.is("keyboard-dragging") ?? false,
            draggingFromOtherTree:
                live?.is("dragging-from-other-tree") ?? false,
            empty: tree.rootItemIds.length === 0,
        };
    });

    protected readonly data = computed(() => {
        const state = this.state();
        return {
            dragging: dataAttr(state.dragging),
            keyboardDragging: dataAttr(state.keyboardDragging),
            draggingFromOtherTree: dataAttr(state.draggingFromOtherTree),
            empty: dataAttr(state.empty),
        };
    });

    /** the options the engine is created with: another value creates another engine */
    private readonly options = computed(() =>
        JSON.stringify({
            hasLoader: this.loadChildren() !== undefined,
            keyMap: this.keyMap() ?? null,
            expandOnClick: this.expandOnClick(),
            checkboxes: this.checkboxes(),
            dragThreshold: this.dragThreshold(),
            autoExpandDelay: this.autoExpandDelay(),
            indentation: this.indentation(),
            indicatorInset: this.indicatorInset(),
            typeAheadTimeout: this.typeAheadTimeout(),
            dragGroup: this.dragGroup(),
            hasTransfer: this.transfer() !== undefined,
        }),
    );

    constructor() {
        // the containing block the drop indicator is positioned in
        bindStructuralStyle(this.host, () => ({ position: "relative" }));

        // the engine is created once the root is rendered in a browser (a server render never
        // starts a load nor listens to the DOM); a new model or a new option recreates it
        const rendered = signal(false);
        afterNextRender(() => rendered.set(true));
        effect((onCleanup) => {
            if (!rendered()) return;
            const model = this.erased();
            this.options();
            // a foreign drop, a drop outside by identity (they hold functions JSON leaves out)
            this.foreignDrop();
            this.dropOutside();
            untracked(() => {
                const engine = this.create(model);
                engine.adapter.attachRoot(this.host);
                this.current.set(engine);
                this.facade.set(engine);
                onCleanup(() => {
                    this.facade.set(null);
                    this.current.set(null);
                    engine.adapter.detachRoot();
                    engine.destroy();
                });
            });
        });

        // the engine's render requests (a drag step, an announcement)
        effect((onCleanup) => {
            const engine = this.current();
            if (!engine) return;
            onCleanup(
                engine.adapter.subscribe(() => {
                    this.tick.update((value) => value + 1);
                }),
            );
        });

        // the controlled lists: the core's and the features' (an Angular input is declared on
        // the class, so a feature's list is an input of every root, used with its feature)
        const outputs: Record<string, { emit(itemIds: string[]): void }> = {
            expandedItemIds: this.expandedItemIdsChange,
            selectedItemIds: this.selectedItemIdsChange,
            checkedItemIds: this.checkedItemIdsChange,
        };
        bindControlledState(
            this.erased,
            () => ({
                expandedItemIds: this.expandedItemIds(),
                selectedItemIds: this.selectedItemIds(),
                checkedItemIds: this.checkedItemIds(),
            }),
            (list, itemIds) => outputs[list]?.emit(itemIds),
        );
        // the installed features' ARIA and data-* (`aria-multiselectable` with `selection()`)
        bindFeatureAttributes(this.host, () => {
            this.treeState();
            this.tick();
            return this.current()?.adapter.rootAttributes() ?? {};
        });
        // misuse the root ignores, once each: a feature's input without its feature, a later
        // change of the features
        const warned = new Set<string>();
        const warn = (message: string) => {
            if (warned.has(message)) return;
            warned.add(message);
            console.warn(`[@fragiola/tree-angular] ${message}`);
        };
        const firstFeatures = untracked(this.features);
        effect(() => {
            const features = this.features();
            if (!this.treeRoot() && features !== firstFeatures) {
                warn(
                    "the features input changed after the root created its model: the change is ignored (the features are fixed when the model is created)",
                );
            }
            const installed = new Set(
                this.erased()
                    .get("features")
                    .map(({ name }) => name),
            );
            const lists: Record<string, unknown> = {
                selectedItemIds: this.selectedItemIds(),
            };
            for (const [name, value] of Object.entries(lists)) {
                const feature = FEATURE_ROOT_PROPS[name];
                if (value !== undefined && feature && !installed.has(feature)) {
                    warn(
                        `${name} needs the ${feature} feature (\`${feature}()\` in the model's features): it is ignored`,
                    );
                }
            }
        });

        onDestroy(() => this.facade.set(null));
    }

    private create(model: TreeModel): TreeEngine {
        const loader = untracked(this.loadChildren);
        return createTreeEngine(model, {
            // the callbacks are read when called: a new function recreates nothing
            loadChildren:
                loader === undefined
                    ? undefined
                    : (item, context) => {
                          const load = untracked(this.loadChildren) as
                              | LoadChildren
                              | undefined;
                          return load
                              ? load(item, context)
                              : Promise.reject(new Error("no loadChildren"));
                      },
            announce: (event) => untracked(this.announce)?.(event),
            keyMap: untracked(this.keyMap),
            expandOnClick: untracked(this.expandOnClick),
            checkboxes: untracked(this.checkboxes),
            dragThreshold: untracked(this.dragThreshold),
            autoExpandDelay: untracked(this.autoExpandDelay),
            indentation: untracked(this.indentation),
            indicatorInset: untracked(this.indicatorInset),
            typeAheadTimeout: untracked(this.typeAheadTimeout),
            dragGroup: untracked(this.dragGroup),
            transfer:
                untracked(this.transfer) === undefined
                    ? undefined
                    : (event) => untracked(this.transfer)?.(event),
            foreignDrop: untracked(this.foreignDrop) as
                | TreeForeignDrop
                | undefined,
            dropOutside: untracked(this.dropOutside) as
                | TreeDropOutside
                | undefined,
            // a new engine (a new model or option, a re-render) loads what this one was loading
            resetLoadsOnDestroy: true,
        });
    }

    /** the keys go to the engine (the APG Tree View model, type-ahead, the keyboard drag) */
    protected onKeyDown(event: KeyboardEvent): void {
        untracked(this.current)?.adapter.handleKeyDown(event);
    }

    /** native drags bring foreign content (`foreignDrop`); the engine ignores them without it */
    protected onDrag(event: DragEvent): void {
        untracked(this.current)?.adapter.handleDragEvent(event);
    }
}
