// One engine's drag session: the drag under way and everything the drag features share of the
// engine (the `DragHost` of host.ts). The first drag feature of an engine creates it
// (`dragSessionOf`, through the engine's `shared` slot); the others find it there, so drag and
// drop, drag groups, foreign drops and drops outside work together without importing each other.
import { fail, ok } from "../commands/define";
import type { CommandResult } from "../commands/types";
import { windowOf } from "../dom/owner";
import type { AnnounceEvent } from "../engine/host";
import { FEATURE_KEYS, type FeatureName } from "../features/keys";
import type { FeatureEngine, FeatureEngineHost } from "../features/types";
import type { TreeModel } from "../state/model";
import { indicatorOf } from "./drop-target";
import type {
    DragGroupLike,
    DragHost,
    DragState,
    DropOutsideController,
    DropTuning,
    ResolvedDragOptions,
    TransferHandler,
} from "./host";

/** The drag tuning one feature gives (drag and drop's wins over a foreign drop's). */
interface Tuning extends DropTuning {
    dragThreshold?: number | undefined;
    transfer?: TransferHandler | undefined;
}

export class DragSession implements DragHost {
    readonly model: TreeModel;
    private dragState: DragState | null = null;
    private readonly tunings: { tuning: Tuning; primary: boolean }[] = [];
    private resolved: ResolvedDragOptions | undefined;
    /** what ends each kind of drag under way (pointer, keyboard, foreign) */
    private readonly cancellers = new Set<() => void>();
    /** the drag group the root joined (`dragGroup()`) */
    group: DragGroupLike | undefined;
    /** the app's drop outside every tree (`dropOutside()`) */
    outside: DropOutsideController | undefined;

    constructor(private readonly host: FeatureEngineHost) {
        this.model = host.model as unknown as TreeModel;
    }

    /** Adds a feature's tuning; a `primary` one (drag and drop's) wins over the others. */
    tune(tuning: Tuning, primary = false): void {
        this.tunings.push({ tuning, primary });
        this.resolved = undefined;
    }

    get options(): ResolvedDragOptions {
        if (this.resolved) return this.resolved;
        const ordered = [
            ...this.tunings.filter((entry) => entry.primary),
            ...this.tunings.filter((entry) => !entry.primary),
        ].map((entry) => entry.tuning);
        const first = <K extends keyof Tuning>(key: K): Tuning[K] =>
            ordered.find((tuning) => tuning[key] !== undefined)?.[key];
        const autoScroll = first("autoScroll");
        this.resolved = {
            dragThreshold: first("dragThreshold") ?? 4,
            autoExpandDelay: first("autoExpandDelay") ?? 800,
            indentation: first("indentation") ?? 16,
            indicatorInset: first("indicatorInset") ?? 0,
            autoScroll: {
                threshold: autoScroll?.threshold ?? 40,
                speed: autoScroll?.speed ?? 12,
            },
            transfer: first("transfer"),
        };
        return this.resolved;
    }

    /** Registers what ends a kind of drag; `cancel-drag` and a detached root call it. */
    onCancel(cancel: () => void): void {
        this.cancellers.add(cancel);
    }

    /** Ends every drag under way here, with nothing committed. */
    cancelAll(): void {
        for (const cancel of [...this.cancellers]) cancel();
    }

    root(): HTMLElement | undefined {
        return this.host.root();
    }

    contentOf(itemId: string): HTMLElement | undefined {
        return this.host.contentOf(itemId);
    }

    direction(): "ltr" | "rtl" {
        return this.host.direction();
    }

    scheduler() {
        return this.host.scheduler();
    }

    drag(): DragState | null {
        return this.dragState;
    }

    setDrag(drag: DragState | null): void {
        this.dragState = drag;
        this.host.changed();
    }

    announce(event: AnnounceEvent): void {
        this.host.announce(event);
    }

    isDestroyed(): boolean {
        return this.host.isDestroyed();
    }

    renderedRows():
        | { readonly start: number; readonly end: number }
        | undefined {
        return this.host.viewport()?.rendered();
    }

    unrenderedRowBox(
        itemId: string,
    ): { top: number; height: number } | undefined {
        return this.host.viewport()?.unrenderedRowBox(itemId);
    }

    scrollContainer(): HTMLElement | undefined {
        const viewport = this.host.viewport();
        if (viewport) return viewport.scrollElement();
        const root = this.host.root();
        return root && scrollParent(root);
    }

    reveal(itemId: string): void {
        this.host.viewport()?.reveal(itemId);
    }

    dragGroup(): DragGroupLike | undefined {
        return this.group;
    }

    dropOutside(): DropOutsideController | undefined {
        return this.outside;
    }

    /** `engine.run("cancel-drag")`: ends the drag under way (a group's from its source tree). */
    cancelDrag(dryRun: boolean): CommandResult<unknown> {
        const drag = this.dragState;
        if (!drag) return fail("refused", "no drag is under way");
        if (!dryRun) {
            // a drag from another tree of the group is that tree's to cancel
            drag.origin?.cancel();
            this.cancelAll();
        }
        return ok({});
    }

    /** The engine verbs of the drag state, as the feature `name` owns them (FEATURE_KEYS). */
    verbs(name: FeatureName): Pick<FeatureEngine, "run" | "get" | "is"> {
        const itemIdOf = (payload: unknown) =>
            (payload as { itemId?: unknown }).itemId;
        const run: Record<
            string,
            (payload: unknown, dryRun: boolean) => CommandResult<unknown>
        > = {
            "cancel-drag": (_payload, dryRun) => this.cancelDrag(dryRun),
        };
        const get: Record<string, () => unknown> = {
            "drop-target": () => this.dragState?.target ?? null,
            "dragging-item-ids": () => this.dragState?.itemIds ?? [],
            "drop-indicator": () => {
                const target = this.dragState?.target;
                return target ? indicatorOf(this, target) : null;
            },
            "drop-outside-element": () => this.outside?.element() ?? null,
        };
        const is: Record<string, (payload: unknown) => boolean> = {
            dragging: () => this.dragState !== null,
            "keyboard-dragging": () => this.dragState?.mode === "keyboard",
            "dragging-from-other-tree": () =>
                this.dragState?.origin !== undefined,
            "item-dragging": (payload) => {
                const itemId = itemIdOf(payload);
                return (
                    typeof itemId === "string" &&
                    (this.dragState?.itemIds.includes(itemId) ?? false)
                );
            },
            "item-drop-target": (payload) => {
                const itemId = itemIdOf(payload);
                return (
                    typeof itemId === "string" &&
                    this.dragState?.target?.itemId === itemId
                );
            },
        };
        const keys = FEATURE_KEYS[name];
        return {
            run: pick(run, keys.engineRun),
            get: pick(get, keys.engineGet),
            is: pick(is, keys.engineIs),
        };
    }
}

function pick<V>(
    table: Record<string, V>,
    keys: readonly string[],
): Record<string, V> {
    const picked: Record<string, V> = {};
    for (const key of keys) {
        const value = table[key];
        if (value !== undefined) picked[key] = value;
    }
    return picked;
}

/** The drag session of an engine: the one its drag features share. */
export function dragSessionOf(host: FeatureEngineHost): DragSession {
    return host.shared("drag-session", () => new DragSession(host));
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
