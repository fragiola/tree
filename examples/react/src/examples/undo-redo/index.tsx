"use client";

import {
    createTreeModel,
    type ItemOf,
    Tree,
    type TreeStateOf,
    useTreeItemRename,
    useTreeState,
} from "@fragiola/tree-react";
import {
    type SelectionFeature,
    selection,
} from "@fragiola/tree-react/selection";
import { ChevronRight, File, Folder, Redo2, Trash2, Undo2 } from "lucide-react";
import { type KeyboardEvent, useState, useSyncExternalStore } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { type FileTypes, fileSystem } from "../_kit/data";
import { UndoManager } from "../_kit/undo";
import * as styles from "./styles";

/** The state of a model with the selection feature. */
type Selected = TreeStateOf<FileTypes, readonly [SelectionFeature]>;

// Undo/redo is app code (`_kit/undo.ts`): it listens to the model's commits, keeps the document
// before each step, and puts it back with `tree.load`. The package ships no history.

/** What a step is called in the history list. */
const STEP_NAMES: Partial<Record<string, string>> = {
    "item.rename": "Rename",
    "item.remove": "Delete",
    "item.move": "Move",
    "item.expand": "Expand",
    "item.collapse": "Collapse",
    "item.toggle": "Expand or collapse",
};
const stepName = (command: string) => STEP_NAMES[command] ?? command;

export default function UndoRedo() {
    const [{ model, history }] = useState(() => {
        const model = createTreeModel<FileTypes, readonly [SelectionFeature]>(
            fileSystem(),
            { features: [selection()] },
        );
        return { model, history: new UndoManager(model) };
    });
    const { canUndo, canRedo, undoSteps, redoSteps } = useSyncExternalStore(
        history.subscribe,
        history.getSnapshot,
        history.getSnapshot,
    );
    const selected = useTreeState<FileTypes, number>(
        (state) => (state as Selected).selectedItemIds.length,
        { model },
    );
    const remove = () =>
        model.run("item.remove", { itemIds: [...model.state.selectedItemIds] });

    // the app's shortcuts, on the tree: Ctrl/⌘+Z undoes, with Shift (or Ctrl+Y) redoes, Delete
    // removes the selection. The tree's own keys run first; these are not among them.
    const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        // the rename input keeps its own Ctrl+Z (the text's undo) and Delete
        if (event.target instanceof HTMLInputElement) return;
        const mod = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();
        if (mod && key === "z") history[event.shiftKey ? "redo" : "undo"]();
        else if (mod && key === "y") history.redo();
        else if (event.key === "Delete" && selected > 0) remove();
        else return;
        event.preventDefault();
    };

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <Clickable.Button
                    variant="outline"
                    size="sm"
                    disabled={!canUndo}
                    onClick={() => history.undo()}
                >
                    <Undo2 aria-hidden />
                    Undo
                </Clickable.Button>
                <Clickable.Button
                    variant="outline"
                    size="sm"
                    disabled={!canRedo}
                    onClick={() => history.redo()}
                >
                    <Redo2 aria-hidden />
                    Redo
                </Clickable.Button>
                <Clickable.Button
                    variant="outline"
                    size="sm"
                    className={styles.deleteButton}
                    disabled={selected === 0}
                    onClick={remove}
                >
                    <Trash2 aria-hidden />
                    Delete
                </Clickable.Button>
            </div>
            <div className={styles.body}>
                <Tree.Root<FileTypes>
                    indicatorInset={styles.indicatorInset}
                    model={model}
                    onKeyDown={onKeyDown}
                    aria-label="Project files"
                    className={styles.root}
                >
                    <Tree.Items<FileTypes>>
                        {(item) => <FileItem item={item} />}
                    </Tree.Items>
                    <Tree.DropIndicator className={styles.dropIndicator} />
                </Tree.Root>
                <section aria-label="History" className={styles.history}>
                    <h2 className={styles.historyTitle}>History</h2>
                    <ol data-testid="history" className={styles.steps}>
                        {undoSteps.length + redoSteps.length === 0 && (
                            <li className={styles.empty}>
                                Rename (F2), drag or delete an item.
                            </li>
                        )}
                        {undoSteps.map((step, index) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: a step has no id
                            <li key={`done-${index}`} className={styles.step}>
                                {stepName(step.command)}
                            </li>
                        ))}
                        {/* redo goes forward through these: the next one is last */}
                        {[...redoSteps].reverse().map((step, index) => (
                            <li
                                // biome-ignore lint/suspicious/noArrayIndexKey: a step has no id
                                key={`undone-${index}`}
                                data-undone=""
                                className={styles.step}
                            >
                                {stepName(step.command)}
                            </li>
                        ))}
                    </ol>
                </section>
            </div>
        </div>
    );
}

function FileItem({ item }: { item: ItemOf<FileTypes> }) {
    return (
        <Tree.Item item={item} className={styles.item}>
            <Tree.ItemContent className={styles.row}>
                <Tree.Toggle className={styles.toggle}>
                    <ChevronRight aria-hidden />
                </Tree.Toggle>
                {item.kind === "folder" ? (
                    <Folder aria-hidden className={styles.folderIcon} />
                ) : (
                    <File aria-hidden className={styles.fileIcon} />
                )}
                <span className={styles.label}>{item.label}</span>
                <RenameField item={item} />
            </Tree.ItemContent>
            <Tree.Group<FileTypes>>
                {(child) => <FileItem item={child} />}
            </Tree.Group>
        </Tree.Item>
    );
}

/** The app's own input, wired by `useTreeItemRename` while the item is renaming (F2). */
function RenameField({ item }: { item: ItemOf<FileTypes> }) {
    const { state, props } = useTreeItemRename(item);
    if (!state.renaming) return null;
    return (
        <input
            {...props}
            aria-label={`Rename ${item.label}`}
            className={styles.input}
        />
    );
}
