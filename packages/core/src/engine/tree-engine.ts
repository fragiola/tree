// The tree engine: one tree on screen. It owns DOM focus, the keyboard (the WAI-ARIA APG Tree View
// model) and the announcements, behind the same verbs as the model; the installed features add
// theirs (drag and drop, type-ahead, the children loader, …). It changes the tree only by running
// the model's commands, so every middleware sees what a key, a click or a drop does.
import { fail, ok } from "../commands/define";
import type { CommandResult } from "../commands/types";
import {
    asElement,
    directionOf,
    isDragExempt,
    PART_ATTRIBUTE,
    schedulerOf,
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
    type KeyAction,
    type KeyMap,
    resolveKeyMap,
} from "../keyboard/key-map";
import type { TreeModel } from "../state/model";
import type { QueryArgs } from "../state/queries";
import type { AnyTypes, TreeTypes } from "../state/types";
import { visibleIndex } from "../state/visible-items";
import type { ScrollAlign } from "../virtual/scroll-target";
import type { KeyEventInput, PressInput, TreeEngineAdapter } from "./adapter";
import type { AnnounceEvent } from "./host";
import type { LoadChildren } from "./load-children";
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
    /**
     * the app's loader of the children of an item with a `childrenStatus` (`asyncChildren()`:
     * ignored without it)
     */
    loadChildren?: LoadChildren<T> | undefined;
    /** the text of the live region for a drag step or a failed load (no text is built in) */
    announce?: ((event: AnnounceEvent) => string | undefined) | undefined;
    /** the key bindings, over the defaults (`DEFAULT_KEY_MAP`) */
    keyMap?: Partial<KeyMap> | undefined;
    /** a click on a parent's content also expands or collapses it (default false: only its toggle does) */
    expandOnClick?: boolean | undefined;
    /**
     * with `asyncChildren()`: `destroy()` puts the items whose children it was loading back to `unloaded`
     * (`item.reset-children`), so the next engine on the model loads them again (default false:
     * they stay `loading`). Adapters set it: a tree that remounts (React's StrictMode, a route
     * change) must not leave an item loading forever
     */
    resetLoadsOnDestroy?: boolean | undefined;
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
    implements TreeEngine<T, F>
{
    readonly model: TreeModel;
    readonly adapter: TreeEngineAdapter<T>;
    private readonly keyMap: KeyMap;
    private readonly settings: TreeEngineOptions<T>;
    private rootElement: HTMLElement | undefined;
    private readonly items = new Map<string, HTMLElement>();
    private readonly contents = new Map<string, HTMLElement>();
    /** what the features of this engine share (`host.shared`) */
    private readonly shared = new Map<string, unknown>();
    /** the tree had DOM focus at the last change: the focused item's new element takes it */
    private refocus = false;
    private announcement = "";
    private revision = 0;
    private destroyed = false;
    private readonly listeners = new Set<() => void>();
    private readonly adapterListeners = new Set<() => void>();
    private readonly unsubscribeModel: () => void;
    private readonly actions: Record<
        Exclude<EngineActionKey, OwnedBy<"engineRun">>,
        ActionHandler
    >;
    /** what the model's features add to this engine */
    private readonly contributions: readonly FeatureEngine[];
    private readonly virtual: FeatureViewport | undefined;
    /** a virtualized tree focuses this item once its row is rendered */
    private pendingFocus: string | undefined;

    constructor(model: TreeModel<T, F>, options: TreeEngineOptions<T>) {
        this.model = model as unknown as TreeModel;
        this.settings = options;
        const host: FeatureEngineHost = {
            model: this.model as unknown as FeatureModel,
            root: () => this.rootElement,
            contentOf: (itemId) => this.contents.get(itemId),
            visible: () => this.model.get("visible-items"),
            visibleIndex: () => visibleIndex(this.model.state),
            pinnedItemIds: () => [
                this.current(),
                ...this.contributions.map((contribution) =>
                    contribution.pinnedItemId?.(),
                ),
                this.pendingFocus,
            ],
            changed: () => this.changed(),
            focus: (itemId) => this.focus({ itemId }, false).ok,
            focusElement: (itemId) => this.focusElement(itemId),
            itemElement: (itemId) => this.items.get(itemId),
            current: () => this.current(),
            scheduler: () => this.scheduler(),
            announce: (event) => this.announce(event),
            isDestroyed: () => this.destroyed,
            options: options as Readonly<Record<string, unknown>>,
            direction: () => this.direction(),
            viewport: () => this.virtual,
            shared: <V>(key: string, create: () => V): V => {
                if (!this.shared.has(key)) this.shared.set(key, create());
                return this.shared.get(key) as V;
            },
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
        this.actions = {
            focus: (payload, dryRun) =>
                this.focus(payload as { itemId: string }, dryRun),
            "scroll-to": (payload, dryRun) =>
                this.scrollTo(payload as { itemId: string }, dryRun),
        };
        this.adapter = this.createAdapter(model as unknown as TreeModel<T>);
        this.unsubscribeModel = model.subscribe(() => this.modelChanged());
        if (options.root) this.attachRoot(options.root);
        for (const contribution of this.contributions) contribution.settled?.();
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
            ? this.actions[action as keyof typeof this.actions]
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
        const values = {
            announcement: () => this.announcement,
            direction: () => this.direction(),
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
        return this.contributed("is", key)?.(payload[0] ?? {}) ?? false;
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
        // what is under way (a drag) ends while the engine can still announce it
        for (const contribution of this.contributions)
            contribution.detached?.();
        this.destroyed = true;
        for (const contribution of this.contributions) contribution.destroy?.();
        this.pendingFocus = undefined;
        this.unsubscribeModel();
        this.listeners.clear();
        this.adapterListeners.clear();
        this.items.clear();
        this.contents.clear();
        this.rootElement = undefined;
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

    // ---------------------------------------------------------------------------------------------
    // what the features share
    // ---------------------------------------------------------------------------------------------

    private direction(): "ltr" | "rtl" {
        return directionOf(this.rootElement);
    }

    private scheduler() {
        return schedulerOf(this.rootElement);
    }

    private announce(event: AnnounceEvent): void {
        if (this.destroyed) return;
        const message = this.settings.announce?.(event);
        if (message === undefined) return;
        this.announcement = message;
        this.changed();
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
        const inside =
            root !== undefined &&
            active !== null &&
            active !== undefined &&
            root.contains(active)
                ? active
                : undefined;
        // a feature's editor this change ended (a rename): it goes away, so focus goes back to the
        // item. Every feature hears every change, wherever focus is, so each keeps its own state
        // current (a rename started from outside the tree ends with focus in its editor)
        let returns = false;
        for (const contribution of this.contributions) {
            if (contribution.modelChanged?.(inside)) returns = true;
        }
        const hadFocus =
            inside !== undefined && (this.isItemElement(inside) || returns);
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
        for (const contribution of this.contributions) contribution.settled?.();
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

    // ---------------------------------------------------------------------------------------------
    // the adapter
    // ---------------------------------------------------------------------------------------------

    private attachRoot(element: HTMLElement): void {
        if (this.rootElement === element) return;
        this.detachRoot();
        this.rootElement = element;
        this.virtual?.attach(element);
        for (const contribution of this.contributions)
            contribution.attached?.(element);
    }

    private detachRoot(): void {
        if (!this.rootElement) return;
        for (const contribution of this.contributions) {
            contribution.detached?.();
            contribution.keysReset?.();
        }
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
                if (this.destroyed || !content) return;
                for (const contribution of this.contributions)
                    contribution.press?.(itemId, event, content);
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
                if (this.destroyed) return;
                for (const contribution of this.contributions)
                    contribution.nativeDrag?.(event);
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
        if (this.destroyed) return;
        // a drag's release is not a click (every feature hears it, so each resets its flag)
        let swallowed = false;
        for (const contribution of this.contributions)
            if (contribution.consumeClick?.()) swallowed = true;
        if (swallowed) return;
        const { model } = this;
        if ((model as unknown as FeatureModel).is("item-renaming", { itemId }))
            return;
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
        // a drag under way takes the keys (a keyboard drag's arrows) or leaves them alone
        for (const contribution of this.contributions) {
            const intercepted = contribution.interceptKey?.(event);
            if (intercepted !== undefined) {
                if (intercepted) event.preventDefault();
                return intercepted;
            }
        }
        const key = directional(event.key, this.direction());
        const action = actionOf(this.keyMap, { ...pick(event), key });
        if (action !== undefined) {
            const handled = this.keyAction(action);
            if (handled) {
                event.preventDefault();
                for (const contribution of this.contributions)
                    contribution.keysReset?.();
            }
            return handled;
        }
        for (const contribution of this.contributions) {
            if (contribution.unboundKey?.(event)) {
                event.preventDefault();
                return true;
            }
        }
        return false;
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
            default:
                return this.featureKey(action, { current, visible, at });
        }
    }

    /** A key's action the core does not handle: the first installed feature that does. */
    private featureKey(action: KeyAction, context: FeatureKeyContext): boolean {
        for (const contribution of this.contributions) {
            const handled = contribution.firstKeyAction?.(action, context);
            if (handled !== undefined) return handled;
        }
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
