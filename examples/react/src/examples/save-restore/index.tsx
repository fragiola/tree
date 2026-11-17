"use client";

import {
    createTreeModel,
    type ItemOf,
    Tree,
    type TreeModel,
    useTreeState,
    validateTree,
} from "@fragiola/tree-react";
import { ChevronRight, File, Folder, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { type FileTypes, fileSystem } from "../_kit/data";
import { persistTree, restoreTree } from "../_kit/persist";
import * as styles from "./styles";

/** Where the document is saved: one key per tree. */
const STORAGE_KEY = "fragiola-tree:examples:save-restore";

/** A model of the saved document when there is a valid one, else of the default. */
function restore(): { model: TreeModel<FileTypes>; restored: boolean } {
    const saved = restoreTree<FileTypes>(STORAGE_KEY);
    // a document saved by an older version of the app may no longer be valid
    const restored = saved !== undefined && validateTree(saved).length === 0;
    const json = restored ? saved : fileSystem();
    return { model: createTreeModel<FileTypes>(json), restored };
}

export default function SaveRestore() {
    const [{ model, restored }] = useState(restore);
    const [savedAt, setSavedAt] = useState<Date>();
    // every committed change of the tree (an expansion, a rename, a move, a removal) is saved
    useEffect(
        () => persistTree(model, STORAGE_KEY, () => setSavedAt(new Date())),
        [model],
    );

    const selected = useTreeState<FileTypes, number>(
        (state) => state.selectedItemIds.length,
        { model },
    );
    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <p
                    role="status"
                    data-testid="save-status"
                    className={styles.status(savedAt !== undefined)}
                >
                    {savedAt
                        ? `Saved at ${savedAt.toLocaleTimeString()}`
                        : restored
                          ? "Restored from this browser"
                          : "Change the tree, then reload the page"}
                </p>
                <Clickable.Button
                    variant="outline"
                    size="sm"
                    disabled={selected === 0}
                    onClick={() =>
                        model.run("item.remove", {
                            itemIds: [...model.state.selectedItemIds],
                        })
                    }
                >
                    <Trash2 aria-hidden />
                    Delete
                </Clickable.Button>
                <Clickable.Button
                    variant="outline"
                    size="sm"
                    // `tree.load` replaces the whole document: the listener saves it too
                    onClick={() =>
                        model.run("tree.load", { json: fileSystem() })
                    }
                >
                    <RotateCcw aria-hidden />
                    Reset
                </Clickable.Button>
            </div>
            <Tree.Root<FileTypes>
                indicatorInset={styles.indicatorInset}
                model={model}
                aria-label="Project files"
                className={styles.root}
            >
                <Tree.Items<FileTypes>>
                    {(item) => <FileItem item={item} />}
                </Tree.Items>
                <Tree.DropIndicator className={styles.dropIndicator} />
            </Tree.Root>
            <p className={styles.hint}>
                Expand, drag, rename (F2) or delete, then reload: the tree comes
                back as you left it.
            </p>
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
                <Tree.RenameInput
                    aria-label={`Rename ${item.label}`}
                    className={styles.input}
                />
            </Tree.ItemContent>
            <Tree.Group<FileTypes>>
                {(child) => <FileItem item={child} />}
            </Tree.Group>
        </Tree.Item>
    );
}
