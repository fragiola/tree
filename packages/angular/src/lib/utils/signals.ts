// From Dockable (fragiola/dockable, packages/angular/src/lib/utils/signals.ts), same author and
// licence: the element registration. Tree adds the registration of a host element.
import { effect, untracked } from "@angular/core";
import type { TreeEngine } from "@fragiola/tree";

/** The element each key of an engine was last registered with. */
const owners = new WeakMap<object, Map<string, HTMLElement>>();

/**
 * Registers `element` with the engine (`register(element)`) and returns its remover, which
 * unregisters (`register(null)`) only while `element` is still the one registered under `key`:
 * when an item moves to another parent (a drop into another folder), its new element can be
 * registered before its old one is destroyed, and the old remover must not unregister the new one.
 */
export function registerElement(
    engine: object,
    key: string,
    element: HTMLElement,
    register: (element: HTMLElement | null) => void,
): () => void {
    let registered = owners.get(engine);
    if (!registered) {
        registered = new Map();
        owners.set(engine, registered);
    }
    const map = registered;
    map.set(key, element);
    register(element);
    return () => {
        if (map.get(key) === element) {
            map.delete(key);
            register(null);
        }
    };
}

/**
 * Registers the host element with the engine for as long as the directive lives: again when the
 * engine (a new model, new options) or the item changes, never while there is no engine.
 */
export function bindRegistration(
    engine: () => TreeEngine | null,
    itemId: () => string | undefined,
    kind: "item" | "content",
    element: HTMLElement,
): void {
    effect((onCleanup) => {
        const current = engine();
        const id = itemId();
        if (!current || id === undefined) return;
        untracked(() => {
            onCleanup(
                registerElement(
                    current,
                    `${kind}:${id}`,
                    element,
                    (registered) =>
                        kind === "item"
                            ? current.adapter.registerItem(id, registered)
                            : current.adapter.registerContent(id, registered),
                ),
            );
        });
    });
}
