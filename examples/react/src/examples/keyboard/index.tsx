"use client";

import {
    type AnnounceEvent,
    createTreeModel,
    type DropTarget,
    type ItemOf,
    Tree,
    type TreeModel,
} from "@fragiola/tree-react";
import { ChevronRight, File, Folder } from "lucide-react";
import { Fragment, useId, useState } from "react";
import { type FileTypes, fileSystem } from "../_kit/data";
import * as styles from "./styles";

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
    // Workaround: a keyboard drag announces its start and its first target at once, so the
    // second message would replace the first before it is read; the start is kept as the
    // first target's prefix (docs/docs-examples-gaps.md).
    let started = "";
    return (event: AnnounceEvent): string | undefined => {
        const prefix = started;
        started = "";
        switch (event.type) {
            case "drag-start":
                started = `Picked up ${names(event.itemIds)}. Up and Down choose a place, Enter drops, Escape cancels.`;
                return started;
            case "drag-over":
                return `${prefix} ${
                    event.target
                        ? `Drop ${where(event.target)}.`
                        : "No place to drop here."
                }`.trim();
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
        createTreeModel<FileTypes>({
            ...fileSystem(),
            settings: { selectionMode: "multiple" },
        }),
    );
    const [announce] = useState(() => announcer(model));
    const legendId = useId();
    return (
        <div className={styles.frame}>
            <div className={styles.treeColumn}>
                <Tree.Root<FileTypes>
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
