"use client";

import {
    type AnnounceEvent,
    createTreeModel,
    type DropTarget,
    type ItemOf,
    Tree,
    type TreeModel,
    type TreeRef,
    useTreeRef,
} from "@fragiola/tree-react";
import { DropIndicator, dragAndDrop } from "@fragiola/tree-react/drag-and-drop";
import { dropOutside } from "@fragiola/tree-react/drop-outside";
import { foreignDrop } from "@fragiola/tree-react/foreign-drop";
import { ChevronRight, File, Folder, Trash2, Upload } from "lucide-react";
import { useCallback, useState, useSyncExternalStore } from "react";
import { type FileTypes, fileSystem, formatSize } from "../_kit/data";
import * as styles from "./styles";

// Files from the desktop (or another window) dropped on the tree: the target shows as for a
// tree drag, and `onDrop` adds one item per file, from its name and size. The package reads no
// file and uploads nothing: what a drop does is the app's commands. Only the types are known
// before the drop, so `accept` takes a drag that carries files.
const files = foreignDrop<FileTypes>({
    accept: ({ types }) => types.includes("Files"),
    onDrop: ({ dataTransfer, to: { parentItemId, index }, model }) => {
        [...dataTransfer.files].forEach((file, i) => {
            model.run("item.add", {
                item: {
                    kind: "file",
                    label: file.name,
                    data: { size: file.size },
                },
                to: { parentItemId, index: index + i },
            });
        });
    },
});

// Rows dragged out of the tree: a release outside it goes to `onDrop`, with the element under the
// pointer. Over the trash it deletes them (`item.remove`); anywhere else it refuses, and the
// drag is cancelled.
const trash = dropOutside<FileTypes>({
    onDrop: ({ itemIds, element, model }) =>
        element?.closest("[data-trash]") != null &&
        model.run("item.remove", { itemIds: [...itemIds] }).ok,
});

/** The opt-in features of the model: the drags, the files dropped on it, the rows dropped outside. */
const features = [
    dragAndDrop({ indicatorInset: styles.indicatorInset }),
    files,
    trash,
] as const;

/** The live region's text for each step: the package writes none. */
function announcer(model: TreeModel<FileTypes>) {
    const label = (itemId: string | null) =>
        itemId === null
            ? "the project"
            : (model.get("item-by", { id: itemId })?.label ?? itemId);
    const where = (target: DropTarget) =>
        target.position === "inside"
            ? `into ${label(target.itemId)}`
            : `${target.position} ${label(target.itemId)}`;
    return (event: AnnounceEvent): string | undefined => {
        switch (event.type) {
            case "foreign-drag-over":
                return event.target
                    ? `Drop the files ${where(event.target)}.`
                    : "No place for files here.";
            case "foreign-drop":
                return `Added the files ${where(event.target)}.`;
            case "drag-start":
                return `Picked up ${event.itemIds.map(label).join(", ")}.`;
            case "drop":
                return `Moved ${where(event.target)}.`;
            case "drop-outside":
                return `Deleted ${event.itemIds.length} item${event.itemIds.length === 1 ? "" : "s"}.`;
            case "drag-cancel":
                return "Cancelled.";
            default:
                return undefined;
        }
    };
}

export default function FileDrop() {
    const [model] = useState(() =>
        createTreeModel<FileTypes, typeof features>(fileSystem(), { features }),
    );
    const [announce] = useState(() => announcer(model));
    const tree = useTreeRef<FileTypes, typeof features>();
    const overTrash = useDragOver(tree);
    return (
        <div className={styles.frame}>
            <Tree.Root<FileTypes, typeof features>
                model={model}
                treeRef={tree}
                announce={announce}
                aria-label="Project files"
                className={styles.root}
            >
                <Tree.Items<FileTypes>>
                    {(item) => <FileItem item={item} />}
                </Tree.Items>
                <DropIndicator className={styles.dropIndicator} />
                <Tree.LiveRegion className={styles.liveRegion} />
            </Tree.Root>
            {/* the app's own target: data-trash is what onDrop looks for */}
            <div
                data-trash=""
                data-over={overTrash ? "" : undefined}
                data-testid="trash"
                className={styles.trash}
            >
                <Trash2 aria-hidden className={styles.trashIcon} />
                Drag rows here to delete them
            </div>
            <p className={styles.hint}>
                <Upload aria-hidden className={styles.hintIcon} /> Drop files
                from your computer into a folder: they are listed, not uploaded.
            </p>
        </div>
    );
}

/**
 * Whether the tree's drag is over the trash: `drop-outside-element` is the element under the
 * pointer while a drag is outside the tree (the pointer stays captured by the row, so the trash
 * gets no pointer events of its own).
 */
function useDragOver(tree: TreeRef<FileTypes, typeof features>): boolean {
    const engine = tree.current?.engine;
    const subscribe = useCallback(
        (onChange: () => void) => engine?.subscribe(onChange) ?? (() => {}),
        [engine],
    );
    return useSyncExternalStore(
        subscribe,
        () =>
            engine?.get("drop-outside-element")?.closest("[data-trash]") !=
            null,
        () => false,
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
                {item.kind === "file" && (
                    <span aria-hidden className={styles.size}>
                        {formatSize(item.data.size)}
                    </span>
                )}
            </Tree.ItemContent>
            <Tree.Group<FileTypes>>
                {(child) => <FileItem item={child} />}
            </Tree.Group>
        </Tree.Item>
    );
}
