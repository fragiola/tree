// Undo/redo for a tree model, as app code: the package ships none, so what counts as a step is the
// app's (here: a change of the structure, the labels, the checks or the expansion; not the
// selection nor the focus). Copy this file and change it freely.
import type {
    AnyTypes,
    CommandEvent,
    CommandName,
    TreeJson,
    TreeModel,
    TreeTypes,
} from "@fragiola/tree-react";

/** `meta` of the `tree.load` an undo or a redo runs, so it is not recorded as a step. */
const UNDO_META = { undo: true } as const;

/** The commands that never make a step: the selection, the focus, a rename's start and end, a load's status. */
const IGNORED: readonly CommandName[] = [
    "item.select",
    "tree.select",
    "tree.select-all",
    "tree.clear-selection",
    "item.focus",
    "item.start-rename",
    "item.cancel-rename",
    "item.set-children-status",
];

/** A step of the history: the command that made it, for a label ("Undo item.move"). */
export interface UndoStep {
    readonly command: CommandName;
}

/** The state of an {@link UndoManager}: the same object until something changes. */
export interface UndoSnapshot {
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    /** the steps undo goes back through, oldest first (the last one is undone next) */
    readonly undoSteps: readonly UndoStep[];
    /** the steps redo goes forward through, the next one last */
    readonly redoSteps: readonly UndoStep[];
}

interface Entry<T extends TreeTypes> {
    readonly step: UndoStep;
    readonly json: TreeJson<T>;
}

/**
 * Undo/redo over the command bus: before each step it keeps the document (`tree-json`), and undo
 * and redo put it back with `tree.load` (the model stays the same; an item that keeps its id keeps
 * its identity). A gesture (a drag's transient auto-expand, then its drop) is one step.
 *
 * ```ts
 * const undo = new UndoManager(model);
 * model.run("item.remove", { itemIds: ["readme"] });
 * undo.undo();
 * ```
 */
export class UndoManager<T extends TreeTypes = AnyTypes> {
    private readonly model: TreeModel<T>;
    private undoBuffer: Entry<T>[] = [];
    private redoBuffer: Entry<T>[] = [];
    /** the document after the last recorded commit: what the next step goes back to */
    private last: TreeJson<T>;
    private gesture = false;
    private readonly listeners = new Set<() => void>();
    private snapshot: UndoSnapshot;

    constructor(model: TreeModel<T>) {
        this.model = model;
        this.last = model.get("tree-json");
        this.snapshot = this.createSnapshot();
        model.subscribe(this.onCommit);
    }

    undo() {
        this.swap(this.undoBuffer, this.redoBuffer);
    }

    redo() {
        this.swap(this.redoBuffer, this.undoBuffer);
    }

    /** The current state, the same object until it changes (bound, for `useSyncExternalStore`). */
    getSnapshot = (): UndoSnapshot => this.snapshot;

    /** Calls `listener` whenever the snapshot changes; returns its remover (bound). */
    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    private readonly onCommit = (event: CommandEvent<T>) => {
        if (event.meta?.undo === true || event.before === event.after) return;
        if (IGNORED.includes(event.command)) {
            // part of the state the next step goes back to, unless a gesture is under way
            if (!this.gesture) this.last = this.model.get("tree-json");
            return;
        }
        if (event.transient) {
            // the gesture's last, non-transient command records the step
            this.gesture = true;
            return;
        }
        this.undoBuffer.push({
            step: { command: event.command },
            json: this.last,
        });
        this.redoBuffer = [];
        this.gesture = false;
        this.last = this.model.get("tree-json");
        this.changed();
    };

    private swap(from: Entry<T>[], to: Entry<T>[]) {
        const entry = from.pop();
        if (!entry) return;
        to.push({ step: entry.step, json: this.model.get("tree-json") });
        // a step is a change, not an edit under way: the document it goes back to may have been
        // taken while a label was being edited (`item.start-rename` comes before the rename)
        const json = { ...entry.json, renamingItemId: null };
        this.model.run("tree.load", { json }, { meta: UNDO_META });
        this.last = this.model.get("tree-json");
        this.changed();
    }

    private changed() {
        this.snapshot = this.createSnapshot();
        for (const listener of [...this.listeners]) listener();
    }

    private createSnapshot(): UndoSnapshot {
        return {
            canUndo: this.undoBuffer.length > 0,
            canRedo: this.redoBuffer.length > 0,
            undoSteps: this.undoBuffer.map((entry) => entry.step),
            redoSteps: this.redoBuffer.map((entry) => entry.step),
        };
    }
}
