// From Dockable (fragiola/dockable, packages/angular/src/lib/utils/signals.ts), same author and
// licence: the element registration. Tree adds the registration of a host element.
import { afterRenderEffect, computed, untracked } from "@angular/core";
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
 * engine (a new model, new options) or the item changes, never while there is no engine. It runs
 * after the render, once the element has its host bindings: the engine may focus an item's element
 * as it is registered (an item moved to another parent is a new element that takes the focus the
 * old one had), and an element without its `tabindex` yet cannot take it.
 */
export function bindRegistration(
    engine: () => TreeEngine | null,
    itemId: () => string | undefined,
    kind: "item" | "content",
    element: HTMLElement,
): void {
    // the id, not the item: a new item object of the same id (its children changed) keeps it
    const currentId = computed(itemId);
    afterRenderEffect((onCleanup) => {
        const current = engine();
        const id = currentId();
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
