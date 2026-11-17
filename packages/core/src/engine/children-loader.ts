// The async children lifecycle. When an item whose children come from the loader is expanded and
// visible while `unloaded`, the engine runs `item.set-children-status loading`, awaits the app's
// `loadChildren(item, { signal })`, then `item.set-children` (or `status: error`). Collapsing
// during a load aborts nothing: the children still arrive. A load whose item leaves `loading` (a
// reset, a removal, a new document) is aborted and runs no command, nor does any load after
// `destroy()` (which, with the engine's `resetLoadsOnDestroy`, puts the items it was loading back to
// `unloaded`). The package itself never loads anything.
import type { TreeItemJson } from "../state/json";
import type { AnyTypes, ItemOf, TreeTypes } from "../state/types";
import type { EngineHost } from "./host";

/** The app's loader: an item's children, as item JSON (their ids generated when omitted). */
export type LoadChildren<T extends TreeTypes = AnyTypes> = (
    item: ItemOf<T>,
    context: { readonly signal: AbortSignal },
) => Promise<readonly TreeItemJson<T>[]>;

export class ChildrenLoader {
    private readonly loads = new Map<string, AbortController>();

    constructor(
        private readonly host: EngineHost,
        private readonly loadChildren: LoadChildren | undefined,
    ) {}

    /** Whether the app gave a loader. */
    get enabled(): boolean {
        return this.loadChildren !== undefined;
    }

    /** Starts the load of every expanded, visible item still `unloaded`. */
    scan(): void {
        if (!this.loadChildren || this.host.isDestroyed()) return;
        const { model } = this.host;
        // a load whose item left "loading" (a reset, a removal, a new document) is stale: abort it
        for (const [itemId, controller] of [...this.loads]) {
            if (model.get("children-status-by", { itemId }) !== "loading") {
                controller.abort();
                this.loads.delete(itemId);
            }
        }
        for (const itemId of model.state.expandedItemIds) {
            if (
                model.get("children-status-by", { itemId }) === "unloaded" &&
                model.is("item-visible", { itemId }) &&
                !this.loads.has(itemId)
            ) {
                this.load(itemId);
            }
        }
    }

    /** Whether a load of the item can start now: a loader, an item it fills, no load under way. */
    canLoad(itemId: string): boolean {
        const status = this.host.model.get("children-status-by", { itemId });
        return (
            this.loadChildren !== undefined &&
            !this.host.isDestroyed() &&
            status !== undefined &&
            status !== "loading" &&
            !this.loads.has(itemId)
        );
    }

    /** Loads an item's children (a first load, or a retry); false when it cannot start. */
    load(itemId: string): boolean {
        const loadChildren = this.loadChildren;
        if (!loadChildren || !this.canLoad(itemId)) return false;
        const { model } = this.host;
        const started = model.run(
            "item.set-children-status",
            { itemId, status: "loading" },
            { meta: { source: "loader" } },
        );
        const item = model.get("item-by", { id: itemId });
        if (!started.ok || !item) return false;
        const controller = new AbortController();
        this.loads.set(itemId, controller);
        const settle = (apply: () => void) => {
            if (this.loads.get(itemId) === controller)
                this.loads.delete(itemId);
            if (controller.signal.aborted || this.host.isDestroyed()) return;
            // a reset, a removal or a new document while it loaded: the result is stale, and the
            // item may need a load of its own
            if (model.get("children-status-by", { itemId }) !== "loading") {
                this.scan();
                return;
            }
            apply();
        };
        let pending: Promise<readonly TreeItemJson[]>;
        try {
            pending = loadChildren(item, { signal: controller.signal });
        } catch (error) {
            pending = Promise.reject(error);
        }
        pending.then(
            (items) =>
                settle(() => {
                    const loaded = model.run(
                        "item.set-children",
                        { itemId, items: [...items] },
                        { meta: { source: "loader" } },
                    );
                    if (!loaded.ok) this.fail(itemId, loaded.error);
                }),
            (error: unknown) => settle(() => this.fail(itemId, error)),
        );
        return true;
    }

    private fail(itemId: string, error: unknown): void {
        this.host.model.run(
            "item.set-children-status",
            { itemId, status: "error" },
            { meta: { source: "loader" } },
        );
        this.host.announce({ type: "load-error", itemId, error });
    }

    /**
     * Aborts every load: none of them runs a command afterwards. With `reset`, the items still
     * loading go back to `unloaded` (`item.reset-children`), so the next engine on the model (a
     * remount) loads them again; without it they stay `loading`.
     */
    destroy(reset = false): void {
        const itemIds = [...this.loads.keys()];
        for (const controller of this.loads.values()) controller.abort();
        this.loads.clear();
        if (!reset) return;
        const { model } = this.host;
        for (const itemId of itemIds) {
            if (model.get("children-status-by", { itemId }) === "loading") {
                model.run(
                    "item.reset-children",
                    { itemId },
                    { meta: { source: "loader" } },
                );
            }
        }
    }
}
