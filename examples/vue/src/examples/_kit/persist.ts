// Saving and restoring a tree, as app code: the package ships no persistence, so where and when to
// save is the app's. The document is `model.get("tree-json")` (JSON v1); `createTreeModel` and the
// `tree.load` command read it back. Copy this file and change it freely.
import type { TreeJson, TreeModel, TreeTypes } from "@fragiola/tree-vue";

/** The saved document under `key`, or undefined (nothing saved, storage blocked, bad JSON). */
export function restoreTree<T extends TreeTypes>(
    key: string,
): TreeJson<T> | undefined {
    try {
        const text = window.localStorage.getItem(key);
        return text ? (JSON.parse(text) as TreeJson<T>) : undefined;
    } catch {
        return undefined;
    }
}

/** Saves the document under `key`; returns whether it could. */
export function saveTree<T extends TreeTypes>(
    key: string,
    json: TreeJson<T>,
): boolean {
    try {
        window.localStorage.setItem(key, JSON.stringify(json));
        return true;
    } catch {
        return false;
    }
}

/** Forgets the document under `key`. */
export function forgetTree(key: string): void {
    try {
        window.localStorage.removeItem(key);
    } catch {
        // storage blocked: nothing was saved
    }
}

/**
 * Saves the model's document after every committed command that changes the tree (a step of a
 * gesture, `transient`, waits for the gesture's end). Returns the function that stops it.
 */
export function persistTree<T extends TreeTypes>(
    model: TreeModel<T>,
    key: string,
    onSave?: (json: TreeJson<T>) => void,
): () => void {
    return model.subscribe((event) => {
        if (event.transient || event.before === event.after) return;
        const json = model.get("tree-json");
        if (saveTree(key, json)) onSave?.(json);
    });
}
