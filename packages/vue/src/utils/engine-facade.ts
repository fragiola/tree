// From packages/react/src/utils/engine-facade.ts: the same facade, framework-free.
// The engine an app sees through `useTree()` and a tree ref: always there, even before the root
// mounted (the first render, the server), and the same object when the root replaces its engine (a
// new model, StrictMode's second mount). It forwards every verb to the root's current engine; with
// none, an action is refused and a read gives the empty answer (no drag, no announcement).
import type {
    CommandResult,
    EngineGetKey,
    EngineGetResult,
    TreeEngine,
    TreeEngineAdapter,
} from "@fragiola/tree";

/** The facade, and how the root points it at its current engine. */
export interface EngineFacade {
    readonly engine: TreeEngine;
    /** points the facade at `engine` (null: the root unmounted), notifying its listeners */
    set(engine: TreeEngine | null): void;
}

const NOT_MOUNTED: CommandResult<never> = Object.freeze({
    ok: false,
    error: Object.freeze({
        code: "refused",
        message: "the tree is not mounted",
    }),
});

const EMPTY: { [K in EngineGetKey]: EngineGetResult<K> } = {
    "drop-target": null,
    "dragging-item-ids": Object.freeze([]),
    "drop-indicator": null,
    announcement: "",
    direction: "ltr",
    "virtual-window": null,
    "drop-outside-element": null,
};

type Verb = (key: string, payload?: unknown) => unknown;

export function createEngineFacade(): EngineFacade {
    let current: TreeEngine | null = null;
    let unsubscribe: () => void = () => {};
    const listeners = new Set<() => void>();
    const notify = () => {
        for (const listener of [...listeners]) listener();
    };
    const forward =
        (verb: "run" | "can" | "check" | "get" | "is", fallback: Verb) =>
        (key: string, payload?: unknown) =>
            current
                ? (current[verb] as unknown as Verb)(key, payload)
                : fallback(key, payload);
    const engine = Object.freeze({
        run: forward("run", () => NOT_MOUNTED),
        can: forward("can", () => false),
        check: forward("check", () => NOT_MOUNTED),
        get: forward("get", (key) =>
            Object.hasOwn(EMPTY, key) ? EMPTY[key as EngineGetKey] : undefined,
        ),
        is: forward("is", () => false),
        subscribe(listener: () => void) {
            const wrapper = () => listener();
            listeners.add(wrapper);
            return () => {
                listeners.delete(wrapper);
            };
        },
        // the root owns its engine and destroys it when it unmounts
        destroy() {},
        get adapter(): TreeEngineAdapter {
            if (!current) throw new Error("the tree is not mounted");
            return current.adapter;
        },
    }) as unknown as TreeEngine;
    return {
        engine,
        set(next) {
            if (next === current) return;
            unsubscribe();
            current = next;
            unsubscribe = next ? next.subscribe(notify) : () => {};
            notify();
        },
    };
}
