// The tree engine: one tree on screen. It owns DOM focus, the keyboard (the WAI-ARIA APG Tree View
// model with type-ahead), the Pointer Events drag and the keyboard drag, the async children
// loader and the announcements, behind the same verbs as the model. It changes the tree only by
// running the model's commands, so every middleware sees what a key, a click or a drop does.
import { fail, ok } from "../commands/define";
import type { CommandResult, NoPayload } from "../commands/types";
import { type DragGroup, joinDragGroup } from "../dnd/drag-group";
import { dragSetOf } from "../dnd/drag-set";
import type {
    DropOutsideController,
    TreeDropOutside,
} from "../dnd/drop-outside";
import { indicatorOf } from "../dnd/drop-target";
import type {
    ForeignDropController,
    TreeForeignDrop,
} from "../dnd/foreign-drop";
import { KeyboardDrag } from "../dnd/keyboard-drag";
import { PointerDrag } from "../dnd/pointer-drag";
import { modifiersOf, type TransferHandler } from "../dnd/transfer";
import {
    asElement,
    directionOf,
    isDragExempt,
    PART_ATTRIBUTE,
    schedulerOf,
    windowOf,
} from "../dom/owner";
import type { OwnedBy } from "../features/keys";
import { featuresOf, requiresFeature } from "../features/registry";
import type {
    EngineActionKeyOf,
    EngineGetKeyOf,
    EngineIsKeyOf,
    FeatureEngine,
    FeatureEngineHost,
    FeatureKeyContext,
    FeatureModel,
    FeatureViewport,
    TreeFeatures,
} from "../features/types";
import {
    actionOf,
    directional,
    isTypeAheadKey,
    type KeyAction,
    type KeyMap,
    resolveKeyMap,
} from "../keyboard/key-map";
import { TypeAhead } from "../keyboard/type-ahead";
import type { TreeModel } from "../state/model";
import type { QueryArgs } from "../state/queries";
import type { AnyTypes, TreeTypes } from "../state/types";
import { visibleIndex } from "../state/visible-items";
import type { ScrollAlign } from "../virtual/scroll-target";
import type { KeyEventInput, PressInput, TreeEngineAdapter } from "./adapter";
import { ChildrenLoader, type LoadChildren } from "./children-loader";
import type {
    AnnounceEvent,
    DragState,
    EngineHost,
    ResolvedEngineOptions,
} from "./host";
import type {
    EngineActionKey,
    EngineActionPayload,
    EngineActionResult,
    EngineGetKey,
    EngineGetPayload,
    EngineGetResult,
    EngineIsPayload,
} from "./verbs";

/** Options of {@link createTreeEngine}. */
export interface TreeEngineOptions<T extends TreeTypes = AnyTypes> {
    /** the root element (`role="tree"`); an adapter may attach it later (`engine.adapter.attachRoot`) */
    root?: HTMLElement | undefined;
    /** the app's loader of the children of an item with a `childrenStatus` */
    loadChildren?: LoadChildren<T> | undefined;
    /** the text of the live region for a drag step or a failed load (no text is built in) */
    announce?: ((event: AnnounceEvent) => string | undefined) | undefined;
    /** the key bindings, over the defaults (`DEFAULT_KEY_MAP`) */
    keyMap?: Partial<KeyMap> | undefined;
    /** a click on a parent's content also expands or collapses it (default false: only its toggle does) */
    expandOnClick?: boolean | undefined;
    /** Space toggles the focused item's checkbox instead of its selection (default false) */
    checkboxes?: boolean | undefined;
    /** how far (px) a press moves before it is a drag (default 4) */
    dragThreshold?: number | undefined;
    /** how long (ms) a drag hovers a collapsed parent before it expands (default 800) */
    autoExpandDelay?: number | undefined;
    /** the indentation of one level (px): the pointer's inline offset at the end of a sublist picks the level (default 16) */
    indentation?: number | undefined;
    /**
     * how far (px) a drop line (`before`, `after`) starts past its level's inline start, for rows
     * whose label starts after a toggle, a grip or padding (default 0); the `inside` box gets no
     * inset (it starts at its child level, `(level - 1) * indentation`).
     * `engine.get("drop-indicator").inlineOffset` includes it
     */
    indicatorInset?: number | undefined;
    /** how close (px) to a scroll container's edge a drag scrolls it, and how fast (px per frame) */
    autoScroll?: { threshold?: number; speed?: number } | undefined;
    /** how long (ms) between two typed characters keeps one type-ahead search (default 500) */
    typeAheadTimeout?: number | undefined;
    /**
     * `destroy()` puts the items whose children it was loading back to `unloaded`
     * (`item.reset-children`), so the next engine on the model loads them again (default false:
     * they stay `loading`). Adapters set it: a tree that remounts (React's StrictMode, a route
     * change) must not leave an item loading forever
     */
    resetLoadsOnDestroy?: boolean | undefined;
    /**
     * joins the trees of the same document with the same group name: items drag between them, by
     * pointer and keyboard. Over one model a drop is one `item.move`; over two it is a transfer
     * (`transfer`). Without it, a drag stays in its tree
     */
    dragGroup?: string | undefined;
    /**
     * what a drop from a tree of another model does here (the receiving tree's, else the source
     * tree's): run the app's commands (copy, convert kinds, …) and return false to refuse; asked
     * first with `dryRun` for each target, which it hides by returning false. Without it, the
     * target model adds the dragged subtrees (`item.add` in a `batch`) and the source model removes
     * them (`item.remove`)
     */
    transfer?: TransferHandler | undefined;
    /**
     * takes foreign content (files, links, text) dragged on the tree from the desktop or another
     * window (`createTreeForeignDrop(options)`): the target shows as for a tree drag, and the app's
     * `onDrop` reads the data and runs its commands. Without it, native drags are ignored
     */
    foreignDrop?: TreeForeignDrop<T> | undefined;
    /**
     * hands the app a pointer drag of the tree's items released outside every tree of its group
     * (`createTreeDropOutside(options)`), for its own targets. Without it, such a release cancels
     */
    dropOutside?: TreeDropOutside<T> | undefined;
}

/**
 * One tree on screen. Every member is one verb, as on the model: `run` a screen action, `can` /
 * `check` it, `get` a fact of the screen, `is` a yes/no question; `subscribe` listens to the
 * engine's own state (a drag, an announcement); `destroy` releases it. `adapter` is what only an
 * adapter calls.
 */
export interface TreeEngine<
    T extends TreeTypes = AnyTypes,
    F extends TreeFeatures = readonly [],
> {
    run<K extends EngineActionKeyOf<F>>(
        action: K,
        ...payload: QueryArgs<EngineActionPayload<K>>
    ): CommandResult<EngineActionResult<K>>;
    can<K extends EngineActionKeyOf<F>>(
        action: K,
        ...payload: QueryArgs<EngineActionPayload<K>>
    ): boolean;
    check<K extends EngineActionKeyOf<F>>(
        action: K,
        ...payload: QueryArgs<EngineActionPayload<K>>
    ): CommandResult<EngineActionResult<K>>;
    get<K extends EngineGetKeyOf<F>>(
        key: K,
        ...payload: QueryArgs<EngineGetPayload<K>>
    ): EngineGetResult<K>;
    is<K extends EngineIsKeyOf<F>>(
        key: K,
        ...payload: QueryArgs<EngineIsPayload<K>>
    ): boolean;
    /** listens to the engine's own state (a drag step, an announcement); returns its remover */
    subscribe(listener: () => void): () => void;
    /** releases every listener, timer and pending load; no command runs afterwards */
    destroy(): void;
    /** what only an adapter calls */
    readonly adapter: TreeEngineAdapter<T>;
}

type ActionHandler = (
    payload: unknown,
    dryRun: boolean,
) => CommandResult<unknown>;

class Engine<T extends TreeTypes, F extends TreeFeatures>
    implements TreeEngine<T, F>, EngineHost
{
    readonly model: TreeModel;
    readonly options: ResolvedEngineOptions;
    readonly adapter: TreeEngineAdapter<T>;
    private readonly keyMap: KeyMap;
    private readonly settings: TreeEngineOptions<T>;
    private rootElement: HTMLElement | undefined;
    private readonly items = new Map<string, HTMLElement>();
    private readonly contents = new Map<string, HTMLElement>();
    private dragState: DragState | null = null;
    /** the tree had DOM focus at the last change: the focused item's new element takes it */
    private refocus = false;
    private announcement = "";
    private revision = 0;
    private destroyed = false;
    private readonly listeners = new Set<() => void>();
    private readonly adapterListeners = new Set<() => void>();
    private readonly pointerDrag: PointerDrag;
    private readonly keyboardDrag: KeyboardDrag;
    private readonly loader: ChildrenLoader;
    private readonly typeAhead: TypeAhead;
    private readonly unsubscribeModel: () => void;
    private readonly actions: Record<EngineActionKey, ActionHandler>;
    /** what the model's features add to this engine */
    private readonly contributions: readonly FeatureEngine[];
    private readonly virtual: FeatureViewport | undefined;
    /** a virtualized tree focuses this item once its row is rendered */
    private pendingFocus: string | undefined;
    /** the renaming item as of the last model change, to find its editor once the rename ends */
    private renamingItemId: string | null = null;
    /** the drag group joined with the root (`dragGroup`) */
    private group: { group: DragGroup; leave: () => void } | undefined;
    private readonly foreign: ForeignDropController | undefined;
    private readonly outside: DropOutsideController | undefined;

    constructor(model: TreeModel<T, F>, options: TreeEngineOptions<T>) {
        this.model = model as unknown as TreeModel;
        this.settings = options;
        this.options = {
            dragThreshold: options.dragThreshold ?? 4,
            autoExpandDelay: options.autoExpandDelay ?? 800,
            indentation: options.indentation ?? 16,
            indicatorInset: options.indicatorInset ?? 0,
            autoScroll: {
                threshold: options.autoScroll?.threshold ?? 40,
                speed: options.autoScroll?.speed ?? 12,
            },
            typeAheadTimeout: options.typeAheadTimeout ?? 500,
            transfer: options.transfer,
        };
        const host: FeatureEngineHost = {
            model: this.model as unknown as FeatureModel,
            root: () => this.rootElement,
            contentOf: (itemId) => this.contents.get(itemId),
            visible: () => this.model.get("visible-items"),
            visibleIndex: () => visibleIndex(this.model.state),
            pinnedItemIds: () => [
                this.current(),
                this.model.state.renamingItemId,
                this.pendingFocus,
                this.pointerDrag.pressedItemId,
            ],
            changed: () => this.changed(),
            focus: (itemId) => this.focus({ itemId }, false).ok,
        };
        this.contributions = featuresOf(model).list.flatMap((feature) => {
            const contribution = feature.engine?.(host);
            return contribution ? [contribution] : [];
        });
        this.virtual = this.contributions.find(
            (contribution) => contribution.viewport,
        )?.viewport;
        // the page keys are a virtualized tree's: elsewhere PageDown and PageUp stay the
        // browser's, and an app's own binding of them keeps working
        this.keyMap = resolveKeyMap(
            this.virtual
                ? options.keyMap
                : {
                      "focus-page-down": [],
                      "focus-page-up": [],
                      ...options.keyMap,
                  },
        );
        this.pointerDrag = new PointerDrag(this);
        this.keyboardDrag = new KeyboardDrag(this);
        this.loader = new ChildrenLoader(
            this,
            options.loadChildren as LoadChildren | undefined,
        );
        this.typeAhead = new TypeAhead(
            () => this.scheduler(),
            this.options.typeAheadTimeout,
        );
        this.actions = {
            focus: (payload, dryRun) =>
                this.focus(payload as { itemId: string }, dryRun),
            "scroll-to": (payload, dryRun) =>
                this.scrollTo(payload as { itemId: string }, dryRun),
            "load-children": (payload, dryRun) =>
                this.loadChildren(payload as { itemId: string }, dryRun),
            "start-keyboard-drag": (payload, dryRun) =>
                this.startKeyboardDrag(
                    payload as { itemIds: string[] },
                    dryRun,
                ),
            "cancel-drag": (_payload, dryRun) => this.cancelDrag(dryRun),
            "commit-rename": (payload, dryRun) =>
                this.commitRename(
                    payload as EngineActionPayload<"commit-rename">,
                    dryRun,
                ),
            "cancel-rename": (payload, dryRun) =>
                this.cancelRename(
                    payload as EngineActionPayload<"cancel-rename">,
                    dryRun,
                ),
        };
        this.adapter = this.createAdapter(model as unknown as TreeModel<T>);
        this.foreign = options.foreignDrop?.connect(this);
        this.outside = options.dropOutside?.connect(this, () => this.changed());
        this.renamingItemId = this.model.state.renamingItemId;
        this.unsubscribeModel = model.subscribe(() => this.modelChanged());
        if (options.root) this.attachRoot(options.root);
        this.loader.scan();
    }

    // ---------------------------------------------------------------------------------------------
    // the verbs
    // ---------------------------------------------------------------------------------------------

    run<K extends EngineActionKeyOf<F>>(
        action: K,
        ...payload: QueryArgs<EngineActionPayload<K>>
    ): CommandResult<EngineActionResult<K>> {
        return this.perform(action, payload[0], false) as CommandResult<
            EngineActionResult<K>
        >;
    }

    can<K extends EngineActionKeyOf<F>>(
        action: K,
        ...payload: QueryArgs<EngineActionPayload<K>>
    ): boolean {
        return this.perform(action, payload[0], true).ok;
    }

    check<K extends EngineActionKeyOf<F>>(
        action: K,
        ...payload: QueryArgs<EngineActionPayload<K>>
    ): CommandResult<EngineActionResult<K>> {
        return this.perform(action, payload[0], true) as CommandResult<
            EngineActionResult<K>
        >;
    }

    private perform(
        action: string,
        payload: unknown,
        dryRun: boolean,
    ): CommandResult<unknown> {
        if (this.destroyed) return fail("refused", "the engine was destroyed");
        const handler = Object.hasOwn(this.actions, action)
            ? this.actions[action as EngineActionKey]
            : this.contributed("run", action);
        if (!handler) {
            const owner = featuresOf(this.model).missing("engineRun", action);
            return owner !== undefined
                ? fail("not_found", `"${action}" ${requiresFeature(owner)}`)
                : fail("unknown_command", `unknown action "${action}"`);
        }
        return handler(payload ?? {}, dryRun);
    }

    /** A feature's engine verb for `key`, if an installed feature has one. */
    private contributed<V extends "run" | "get" | "is">(
        verb: V,
        key: string,
    ): NonNullable<FeatureEngine[V]>[string] | undefined {
        for (const contribution of this.contributions) {
            const table = contribution[verb];
            if (table && Object.hasOwn(table, key))
                return table[key] as NonNullable<FeatureEngine[V]>[string];
        }
        return undefined;
    }

    get<K extends EngineGetKeyOf<F>>(
        key: K,
        ...payload: QueryArgs<EngineGetPayload<K>>
    ): EngineGetResult<K> {
        void payload;
        const values = {
            "drop-target": () => this.dragState?.target ?? null,
            "dragging-item-ids": () => this.dragState?.itemIds ?? [],
            "drop-indicator": () => {
                const target = this.dragState?.target;
                return target ? indicatorOf(this, target) : null;
            },
            announcement: () => this.announcement,
            direction: () => this.direction(),
            "drop-outside-element": () => this.outside?.element() ?? null,
        } satisfies {
            [G in Exclude<
                EngineGetKey,
                OwnedBy<"engineGet">
            >]: () => EngineGetResult<G>;
        };
        if (Object.hasOwn(values, key))
            return values[key as keyof typeof values]() as EngineGetResult<K>;
        return this.contributed(
            "get",
            key,
        )?.(payload[0] ?? {}) as EngineGetResult<K>;
    }

    is<K extends EngineIsKeyOf<F>>(
        key: K,
        ...payload: QueryArgs<EngineIsPayload<K>>
    ): boolean {
        const itemId = (payload[0] as { itemId?: string } | undefined)?.itemId;
        switch (key) {
            case "dragging":
                return this.dragState !== null;
            case "keyboard-dragging":
                return this.dragState?.mode === "keyboard";
            case "dragging-from-other-tree":
                return this.dragState?.origin !== undefined;
            case "item-dragging":
                return (
                    itemId !== undefined &&
                    (this.dragState?.itemIds.includes(itemId) ?? false)
                );
            case "item-drop-target":
                return (
                    itemId !== undefined &&
                    this.dragState?.target?.itemId === itemId
                );
            default:
                return this.contributed("is", key)?.(payload[0] ?? {}) ?? false;
        }
    }

    subscribe(listener: () => void): () => void {
        const wrapper = () => listener();
        this.listeners.add(wrapper);
        return () => {
            this.listeners.delete(wrapper);
        };
    }

    destroy(): void {
        if (this.destroyed) return;
        this.pointerDrag.cancel();
        this.keyboardDrag.cancel();
        this.foreign?.cancel();
        this.leaveGroup();
        this.destroyed = true;
        this.loader.destroy(this.settings.resetLoadsOnDestroy === true);
        for (const contribution of this.contributions) contribution.destroy?.();
        this.pendingFocus = undefined;
        this.typeAhead.reset();
        this.unsubscribeModel();
        this.listeners.clear();
        this.adapterListeners.clear();
        this.items.clear();
        this.contents.clear();
        this.rootElement = undefined;
        this.dragState = null;
    }

    // ---------------------------------------------------------------------------------------------
    // the actions
    // ---------------------------------------------------------------------------------------------

    private focus(
        { itemId }: { itemId: string },
        dryRun: boolean,
    ): CommandResult<unknown> {
        const checked = this.model.check("item.focus", { itemId });
        if (!checked.ok || dryRun) return checked;
        const result = this.model.run("item.focus", { itemId });
        if (!result.ok) return result;
        this.focusElement(itemId);
        return ok({ itemId });
    }

    private focusElement(itemId: string): void {
        const element = this.items.get(itemId);
        if (!element) {
            // a virtualized tree scrolls to the row first: its element takes focus once rendered
            if (this.virtual?.reveal(itemId)) this.pendingFocus = itemId;
            return;
        }
        this.pendingFocus = undefined;
        if (element.ownerDocument.activeElement !== element) {
            element.focus({ preventScroll: true });
        }
        // a virtualized tree's pinned row (the tab stop) is rendered wherever the scroll is: the
        // scroll follows the rows' offsets, then the element's own box
        this.virtual?.reveal(itemId);
        element.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }

    private scrollTo(
        { itemId, align }: { itemId: string; align?: ScrollAlign | undefined },
        dryRun: boolean,
    ): CommandResult<unknown> {
        if (!this.model.get("item-by", { id: itemId })) {
            return fail("not_found", `"${itemId}" is not an item`, "/itemId");
        }
        const element = this.items.get(itemId);
        if (element && !this.virtual) {
            if (!dryRun)
                element.scrollIntoView?.({
                    block: align ?? "nearest",
                    inline: "nearest",
                });
            return ok({ itemId });
        }
        if (!this.virtual)
            return fail("refused", `"${itemId}" is not rendered`, "/itemId");
        // a virtualized tree scrolls by the rows' offsets, rendered or not
        if (!this.model.is("item-visible", { itemId }))
            return fail("refused", `"${itemId}" is not visible`, "/itemId");
        if (!dryRun) this.virtual.reveal(itemId, align);
        return ok({ itemId });
    }

    private loadChildren(
        { itemId }: { itemId: string },
        dryRun: boolean,
    ): CommandResult<unknown> {
        if (!this.model.get("item-by", { id: itemId })) {
            return fail("not_found", `"${itemId}" is not an item`, "/itemId");
        }
        if (!this.loader.canLoad(itemId)) {
            return fail(
                "refused",
                this.loader.enabled
                    ? `"${itemId}" has no children to load now (none from the loader, or a load is under way)`
                    : "the engine has no loadChildren",
                "/itemId",
            );
        }
        if (!dryRun) this.loader.load(itemId);
        return ok({ itemId });
    }

    private startKeyboardDrag(
        { itemIds }: { itemIds: string[] },
        dryRun: boolean,
    ): CommandResult<unknown> {
        if (!Array.isArray(itemIds) || itemIds.length === 0) {
            return fail(
                "invalid_payload",
                "must have at least 1 item(s)",
                "/itemIds",
            );
        }
        for (const [i, itemId] of itemIds.entries()) {
            if (!this.model.get("item-by", { id: itemId })) {
                return fail(
                    "not_found",
                    `"${itemId}" is not an item`,
                    `/itemIds/${i}`,
                );
            }
            if (!this.model.is("item-movable", { itemId })) {
                return fail(
                    "refused",
                    `"${itemId}" cannot move`,
                    `/itemIds/${i}`,
                );
            }
        }
        if (this.dragState || this.pointerDrag.pressed) {
            return fail("refused", "a drag is under way");
        }
        if (dryRun) return ok({ itemIds: [...itemIds] });
        return this.keyboardDrag.start(itemIds)
            ? ok({ itemIds: [...itemIds] })
            : fail("refused", "the items have nowhere to go");
    }

    private cancelDrag(dryRun: boolean): CommandResult<NoPayload> {
        if (!this.dragState) return fail("refused", "no drag is under way");
        if (!dryRun) {
            // a drag from another tree of the group is that tree's to cancel
            this.dragState.origin?.cancel();
            this.pointerDrag.cancel();
            this.keyboardDrag.cancel();
            this.foreign?.cancel();
        }
        return ok({});
    }

    private commitRename(
        { itemId, label, focus }: EngineActionPayload<"commit-rename">,
        dryRun: boolean,
    ): CommandResult<unknown> {
        const payload = { itemId, label };
        const result = dryRun
            ? this.model.check("item.rename", payload)
            : this.model.run("item.rename", payload);
        if (!result.ok) return result;
        if (!dryRun && focus !== false) this.focusElement(itemId);
        return ok({ itemId });
    }

    private cancelRename(
        { itemId, focus }: EngineActionPayload<"cancel-rename">,
        dryRun: boolean,
    ): CommandResult<unknown> {
        const payload = { itemId };
        const result = dryRun
            ? this.model.check("item.cancel-rename", payload)
            : this.model.run("item.cancel-rename", payload);
        if (!result.ok) return result;
        if (!dryRun && focus !== false) this.focusElement(itemId);
        return ok({ itemId });
    }

    // ---------------------------------------------------------------------------------------------
    // the host the drags and the loader share
    // ---------------------------------------------------------------------------------------------

    root(): HTMLElement | undefined {
        return this.rootElement;
    }

    contentOf(itemId: string): HTMLElement | undefined {
        return this.contents.get(itemId);
    }

    direction(): "ltr" | "rtl" {
        return directionOf(this.rootElement);
    }

    scheduler() {
        return schedulerOf(this.rootElement);
    }

    drag(): DragState | null {
        return this.dragState;
    }

    setDrag(drag: DragState | null): void {
        this.dragState = drag;
        this.changed();
    }

    renderedRows():
        | { readonly start: number; readonly end: number }
        | undefined {
        return this.virtual?.rendered();
    }

    unrenderedRowBox(
        itemId: string,
    ): { top: number; height: number } | undefined {
        return this.virtual?.unrenderedRowBox(itemId);
    }

    scrollContainer(): HTMLElement | undefined {
        if (this.virtual) return this.virtual.scrollElement();
        return this.rootElement && scrollParent(this.rootElement);
    }

    reveal(itemId: string): void {
        this.virtual?.reveal(itemId);
    }

    dragGroup(): DragGroup | undefined {
        return this.group?.group;
    }

    dropOutside(): DropOutsideController | undefined {
        return this.outside;
    }

    private leaveGroup(): void {
        const group = this.group;
        this.group = undefined;
        group?.leave();
        if (this.dragState?.origin) this.setDrag(null);
    }

    announce(event: AnnounceEvent): void {
        if (this.destroyed) return;
        const message = this.settings.announce?.(event);
        if (message === undefined) return;
        this.announcement = message;
        this.changed();
    }

    isDestroyed(): boolean {
        return this.destroyed;
    }

    private changed(): void {
        if (this.destroyed) return;
        this.revision += 1;
        for (const listener of [...this.listeners]) listener();
        for (const listener of [...this.adapterListeners]) listener();
    }

    private modelChanged(): void {
        if (this.destroyed) return;
        // DOM focus follows the focused item when one of the tree's items has it (a collapse, a
        // removal moved it): read before the adapters re-render and remove the old element
        const root = this.rootElement;
        const active = root?.ownerDocument.activeElement;
        // the item whose rename this change ended (a commit, a cancel, another command): its editor
        // goes away, so focus goes back to the item; while a rename goes on, focus stays in it
        const previous = this.renamingItemId;
        this.renamingItemId = this.model.state.renamingItemId;
        const ended = previous !== this.renamingItemId ? previous : null;
        const hadFocus =
            root !== undefined &&
            active !== null &&
            active !== undefined &&
            root.contains(active) &&
            (this.isItemElement(active) || this.inRenamingItem(active, ended));
        // an item moved to another parent is a new element: the adapter registers it after this
        // re-render, and it takes the focus the old one had (registerItem)
        this.refocus = hadFocus || (this.refocus && this.focusLost());
        this.revision += 1;
        for (const listener of [...this.adapterListeners]) listener();
        const focused = this.model.state.focusedItemId;
        if (hadFocus && focused !== null) {
            const element = this.items.get(focused);
            if (element && element.ownerDocument.activeElement !== element) {
                element.focus({ preventScroll: true });
            }
        }
        this.loader.scan();
    }

    /** Whether DOM focus left the tree for nothing (the body, or an element no longer there). */
    private focusLost(): boolean {
        const root = this.rootElement;
        const active = root?.ownerDocument.activeElement;
        return (
            root !== undefined &&
            (active === null ||
                active === undefined ||
                active === root.ownerDocument.body ||
                !active.isConnected)
        );
    }

    private isItemElement(element: Element): boolean {
        for (const item of this.items.values())
            if (item === element) return true;
        return false;
    }

    /**
     * Whether an element is inside the element of the item whose rename just ended: the app's label
     * editor, whatever element it is. Focus elsewhere inside an item is left where it is.
     */
    private inRenamingItem(element: Element, itemId: string | null): boolean {
        if (itemId === null) return false;
        const item = this.items.get(itemId);
        return item !== undefined && item !== element && item.contains(element);
    }

    // ---------------------------------------------------------------------------------------------
    // the adapter
    // ---------------------------------------------------------------------------------------------

    private attachRoot(element: HTMLElement): void {
        if (this.rootElement === element) return;
        this.detachRoot();
        this.rootElement = element;
        this.virtual?.attach(element);
        const name = this.settings.dragGroup;
        if (name !== undefined)
            this.group = joinDragGroup(this, name, element.ownerDocument);
    }

    private detachRoot(): void {
        if (!this.rootElement) return;
        this.pointerDrag.cancel();
        this.keyboardDrag.cancel();
        this.foreign?.cancel();
        this.typeAhead.reset();
        this.leaveGroup();
        this.virtual?.detach();
        this.rootElement = undefined;
    }

    private createAdapter(model: TreeModel<T>): TreeEngineAdapter<T> {
        return {
            model,
            attachRoot: (element) => {
                if (!this.destroyed) this.attachRoot(element);
            },
            detachRoot: () => this.detachRoot(),
            registerItem: (itemId, element) => {
                if (this.destroyed) return;
                if (!element) {
                    this.items.delete(itemId);
                    this.virtual?.observe(itemId, null);
                    return;
                }
                const previous = this.items.get(itemId);
                this.items.set(itemId, element);
                this.virtual?.observe(itemId, element);
                // a virtualized tree's row came into the window for the focus it was scrolled for:
                // it takes it once the adapter's render is done (a focus in the middle of it would
                // lay out a list whose spacers are not there yet, and lose the scroll)
                if (this.pendingFocus === itemId) {
                    this.pendingFocus = undefined;
                    if (itemId === this.model.state.focusedItemId) {
                        this.refocus = false;
                        void Promise.resolve().then(() => {
                            // the item's element then (another may have replaced this one)
                            const current = this.items.get(itemId);
                            if (
                                this.destroyed ||
                                !current ||
                                this.model.state.focusedItemId !== itemId
                            )
                                return;
                            current.focus({ preventScroll: true });
                            this.virtual?.reveal(itemId);
                            current.scrollIntoView?.({
                                block: "nearest",
                                inline: "nearest",
                            });
                        });
                        return;
                    }
                }
                // the focused item's new element takes the focus the tree lost, or the focus its
                // previous element still holds: an adapter (Vue) may attach the new element of a
                // moved item before it removes the old one
                if (
                    this.refocus &&
                    itemId === this.model.state.focusedItemId &&
                    (this.focusLost() ||
                        (previous !== undefined &&
                            previous !== element &&
                            previous.ownerDocument.activeElement === previous))
                ) {
                    this.refocus = false;
                    element.focus({ preventScroll: true });
                }
            },
            registerContent: (itemId, element) => {
                if (this.destroyed) return;
                if (element) this.contents.set(itemId, element);
                else this.contents.delete(itemId);
            },
            handleKeyDown: (event) => this.keyDown(event),
            handlePointerDown: (itemId, event) => {
                const content = this.contents.get(itemId);
                if (!this.destroyed && content)
                    this.pointerDrag.pointerDown(itemId, event, content);
            },
            handleClick: (itemId, event) => this.click(itemId, event),
            handleToggleClick: (itemId) => {
                if (this.destroyed) return;
                this.model.run("item.toggle", { itemId });
            },
            handleFocus: (itemId) => {
                if (this.destroyed || this.model.state.focusedItemId === itemId)
                    return;
                this.model.run("item.focus", { itemId });
            },
            handleDragEvent: (event) => {
                if (!this.destroyed) this.foreign?.handle(event);
            },
            subscribe: (listener) => {
                const wrapper = () => listener();
                this.adapterListeners.add(wrapper);
                return () => {
                    this.adapterListeners.delete(wrapper);
                };
            },
            getSnapshot: () => this.revision,
        };
    }

    // ---------------------------------------------------------------------------------------------
    // pointer and keyboard
    // ---------------------------------------------------------------------------------------------

    private click(itemId: string, event: PressInput): void {
        if (this.destroyed || this.pointerDrag.consumeClick()) return;
        const { model } = this;
        if (model.state.renamingItemId === itemId) return;
        this.focus({ itemId }, false);
        for (const contribution of this.contributions)
            contribution.click?.(itemId, event);
        if (
            this.settings.expandOnClick === true &&
            !model.is("item-leaf", { itemId })
        ) {
            model.run("item.toggle", { itemId });
        }
    }

    /** The item the keys act on: the roving tab stop. */
    private current(): string | undefined {
        return this.model.get("tab-stop-item")?.id;
    }

    private keyDown(event: KeyEventInput): boolean {
        if (this.destroyed) return false;
        // any control inside an item (a button, a link, an input, the app's rename editor: the
        // DRAG_EXEMPT elements) handles its own keys
        const target = asElement(event.target);
        const item = target?.closest(`[${PART_ATTRIBUTE}="item"]`);
        if (target && item && isDragExempt(target, item)) return false;
        if (this.keyboardDrag.active) {
            const handled = this.keyboardDragKey(event);
            if (handled) event.preventDefault();
            return handled;
        }
        if (this.pointerDrag.active) return false;
        const key = directional(event.key, this.direction());
        const action = actionOf(this.keyMap, { ...pick(event), key });
        if (action !== undefined) {
            const handled = this.keyAction(action);
            if (handled) {
                event.preventDefault();
                this.typeAhead.reset();
            }
            return handled;
        }
        if (isTypeAheadKey(event)) {
            const handled = this.typeAheadKey(event.key);
            if (handled) event.preventDefault();
            return handled;
        }
        return false;
    }

    private keyboardDragKey(event: KeyEventInput): boolean {
        switch (event.key) {
            case "ArrowDown":
                this.keyboardDrag.step(1);
                return true;
            case "ArrowUp":
                this.keyboardDrag.step(-1);
                return true;
            case "Enter":
                this.keyboardDrag.drop(modifiersOf(event));
                return true;
            case "Escape":
                this.keyboardDrag.cancel();
                return true;
            default:
                return false;
        }
    }

    private typeAheadKey(character: string): boolean {
        const { model } = this;
        const current = this.current();
        const { text, cycle } = this.typeAhead.type(character);
        let fromItemId: string | null | undefined = current;
        if (!cycle && current !== undefined) {
            // a longer search may stay on the current item: start just before it
            const visible = model.get("visible-items");
            const at = visibleIndex(model.state).get(current) ?? -1;
            fromItemId = at > 0 ? (visible[at - 1]?.itemId ?? null) : null;
        }
        const match = model.get("type-ahead-match", { text, fromItemId });
        if (match) this.focus({ itemId: match.id }, false);
        return true;
    }

    /** Runs a key's action on the focused item; false when it did nothing (the key is not used). */
    private keyAction(action: KeyAction): boolean {
        const { model } = this;
        const current = this.current();
        if (current === undefined) return false;
        const visible = model.get("visible-items");
        const at = visibleIndex(model.state).get(current) ?? -1;
        switch (action) {
            case "focus-next":
                return this.focusAt(visible[at + 1]?.itemId);
            case "focus-previous":
                return this.focusAt(visible[at - 1]?.itemId);
            case "focus-first":
                return this.focusAt(visible[0]?.itemId);
            case "focus-last":
                return this.focusAt(visible.at(-1)?.itemId);
            case "focus-page-down":
            case "focus-page-up": {
                // a page is the rows in view; a tree that is not virtualized leaves the key alone
                const page = this.virtual?.pageRows();
                if (page === undefined || at < 0) return false;
                const to =
                    action === "focus-page-down"
                        ? Math.min(visible.length - 1, at + page)
                        : Math.max(0, at - page);
                return to !== at && this.focusAt(visible[to]?.itemId);
            }
            case "expand-or-focus-child": {
                if (model.is("item-leaf", { itemId: current })) return false;
                if (!model.is("item-expanded", { itemId: current })) {
                    return model.run("item.expand", { itemId: current }).ok;
                }
                const child = visible[at + 1];
                return child?.parentItemId === current
                    ? this.focusAt(child.itemId)
                    : false;
            }
            case "collapse-or-focus-parent": {
                if (
                    !model.is("item-leaf", { itemId: current }) &&
                    model.is("item-expanded", { itemId: current }) &&
                    model.run("item.collapse", { itemId: current }).ok
                ) {
                    return true;
                }
                const parent = visible[at]?.parentItemId;
                return parent ? this.focusAt(parent) : false;
            }
            case "expand-siblings":
                return model.run("item.expand-siblings", { itemId: current })
                    .ok;
            case "toggle":
                if (this.settings.checkboxes === true) {
                    return model.run("item.toggle-check", { itemId: current })
                        .ok;
                }
                return this.featureKey(action, { current, visible, at });
            case "rename":
                return model.run("item.start-rename", { itemId: current }).ok;
            case "start-drag":
                return this.startKeyboardDrag(
                    { itemIds: dragSetOf(model, current) },
                    false,
                ).ok;
            default:
                return this.featureKey(action, { current, visible, at });
        }
    }

    /** A key's action the core does not handle: the first installed feature that does. */
    private featureKey(action: KeyAction, context: FeatureKeyContext): boolean {
        for (const contribution of this.contributions) {
            const handled = contribution.keyAction?.(action, context);
            if (handled !== undefined) return handled;
        }
        return false;
    }

    private focusAt(itemId: string | undefined): boolean {
        return itemId !== undefined && this.focus({ itemId }, false).ok;
    }
}

/** The nearest scroll container of the root (the root itself when it scrolls). */
function scrollParent(root: HTMLElement): HTMLElement | undefined {
    const view = windowOf(root);
    if (!view) return undefined;
    for (let node: HTMLElement | null = root; node; node = node.parentElement) {
        const { overflowY } = view.getComputedStyle(node);
        if (overflowY === "auto" || overflowY === "scroll") return node;
    }
    return undefined;
}

function pick(event: KeyEventInput) {
    return {
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
    };
}

/**
 * Creates the engine of one tree on screen, over its model. Give it the root element now or
 * attach it later (`engine.adapter.attachRoot`, what an adapter does); call `destroy()` when the
 * tree leaves the screen.
 */
export function createTreeEngine<
    T extends TreeTypes = AnyTypes,
    F extends TreeFeatures = readonly [],
>(
    model: TreeModel<T, F>,
    options: TreeEngineOptions<T> = {},
): TreeEngine<T, F> {
    const engine = new Engine<T, F>(model, options);
    // the engine's surface is exactly its verbs, `subscribe`, `destroy` and `adapter`, each bound:
    // `const { run } = engine` works, and the machinery the drags share stays inside
    return Object.freeze({
        run: engine.run.bind(engine),
        can: engine.can.bind(engine),
        check: engine.check.bind(engine),
        get: engine.get.bind(engine),
        is: engine.is.bind(engine),
        subscribe: engine.subscribe.bind(engine),
        destroy: engine.destroy.bind(engine),
        adapter: engine.adapter,
    });
}
