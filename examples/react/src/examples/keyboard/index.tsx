"use client";

import {
    type AnnounceEvent,
    createTreeModel,
    type DropTarget,
    type ItemOf,
    Tree,
    type TreeModel,
} from "@fragiola/tree-react";
import { rename, useTreeItemRename } from "@fragiola/tree-react/rename";
import { selection } from "@fragiola/tree-react/selection";
import { typeAhead } from "@fragiola/tree-react/type-ahead";
import { ChevronRight, File, Folder } from "lucide-react";
import { Fragment, useId, useState } from "react";
import { type FileTypes, fileSystem } from "../_kit/data";
import * as styles from "./styles";

/** The opt-in features of the model: the selection, the rename (F2) and the type-ahead. */
const features = [selection(), rename(), typeAhead()] as const;

// Every key is the engine's (the WAI-ARIA APG tree view, `DEFAULT_KEY_MAP`): the example only
// lists them. `keyMap` on the root would change any of them.
// `join`: "+" for a chord, "/" for two keys doing the two halves of one line.
const KEYS: readonly {
    keys: readonly string[];
    join?: "+" | "/";
    does: string;
}[] = [
    { keys: ["↓", "↑"], join: "/", does: "Next, previous item" },
    { keys: ["→"], does: "Expand, or go to the first child" },
    { keys: ["←"], does: "Collapse, or go to the parent" },
    { keys: ["Home", "End"], join: "/", does: "First, last item" },
    { keys: ["a–z"], does: "Jump to a label (type-ahead)" },
    { keys: ["*"], does: "Expand the siblings" },
    { keys: ["Enter"], does: "Select" },
    { keys: ["Space"], does: "Toggle the selection" },
    { keys: ["Shift", "↓"], does: "Extend the selection" },
    { keys: ["Ctrl", "A"], does: "Select all" },
    { keys: ["F2"], does: "Rename" },
    {
        keys: ["Ctrl", "Shift", "D"],
        does: "Drag: then ↑ ↓, Enter drops, Esc cancels",
    },
];

/** What the live region says at each step of a keyboard (or pointer) drag. */
function announcer(model: TreeModel<FileTypes>) {
    const label = (itemId: string | null) =>
        itemId === null
            ? "the tree"
            : (model.get("item-by", { id: itemId })?.label ?? itemId);
    const names = (itemIds: readonly string[]) => itemIds.map(label).join(", ");
    const where = (target: DropTarget) =>
        target.position === "inside"
            ? `into ${label(target.itemId)}`
            : `${target.position} ${label(target.itemId)}`;
    return (event: AnnounceEvent): string | undefined => {
        switch (event.type) {
            case "drag-start":
                // a keyboard drag's start comes with its first place, said in one message
                return event.target
                    ? `Picked up ${names(event.itemIds)}. Up and Down choose a place, Enter drops, Escape cancels. Drop ${where(event.target)}.`
                    : `Picked up ${names(event.itemIds)}.`;
            case "drag-over":
                return event.target
                    ? `Drop ${where(event.target)}.`
                    : "No place to drop here.";
            case "drop":
                return `Moved ${names(event.itemIds)} ${where(event.target)}.`;
            case "drag-cancel":
                return `Cancelled. ${names(event.itemIds)} stayed in place.`;
            default:
                return undefined;
        }
    };
}

export default function Keyboard() {
    const [model] = useState(() =>
        createTreeModel<FileTypes, typeof features>(
            {
                ...fileSystem(),
                settings: { selectionMode: "multiple" },
            },
            { features },
        ),
    );
    const [announce] = useState(() => announcer(model));
    const legendId = useId();
    return (
        <div className={styles.frame}>
            <div className={styles.treeColumn}>
                <Tree.Root<FileTypes, typeof features>
                    indicatorInset={styles.indicatorInset}
                    model={model}
                    announce={announce}
                    aria-label="Project files"
                    className={styles.root}
                >
                    <Tree.Items<FileTypes>>
                        {(item) => <FileItem item={item} />}
                    </Tree.Items>
                    <Tree.DropIndicator className={styles.dropIndicator} />
                    {/* visible here, to show what a screen reader hears during a drag */}
                    <Tree.LiveRegion className={styles.liveRegion} />
                </Tree.Root>
            </div>
            <section aria-labelledby={legendId} className={styles.legend}>
                <h2 id={legendId} className={styles.legendTitle}>
                    Keys
                </h2>
                <dl className={styles.keyList}>
                    {KEYS.map(({ keys, join = "+", does }) => (
                        <div key={does} className={styles.keyRow}>
                            <dt className={styles.keys}>
                                {keys.map((key, index) => (
                                    <Fragment key={key}>
                                        {index > 0 && (
                                            <span
                                                aria-hidden
                                                className={styles.plus}
                                            >
                                                {join}
                                            </span>
                                        )}
                                        <kbd className={styles.kbd}>{key}</kbd>
                                    </Fragment>
                                ))}
                            </dt>
                            <dd className={styles.does}>{does}</dd>
                        </div>
                    ))}
                </dl>
            </section>
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
