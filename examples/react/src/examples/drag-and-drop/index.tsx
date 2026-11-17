"use client";

import {
    type AnnounceEvent,
    createTreeModel,
    type DropTarget,
    type ItemOf,
    Tree,
    type TreeJson,
    type TreeModel,
} from "@fragiola/tree-react";
import { DropIndicator, dragAndDrop } from "@fragiola/tree-react/drag-and-drop";
import { selection } from "@fragiola/tree-react/selection";
import {
    ChevronRight,
    File,
    Folder,
    FolderLock,
    GripVertical,
    Lock,
} from "lucide-react";
import { useId, useState } from "react";
import * as styles from "./styles";

/** The opt-in features of the model: the selection and the drags (a drop line starts past the grip and the toggle). */
const features = [
    selection(),
    dragAndDrop({ indicatorInset: styles.indicatorInset }),
] as const;

type Types = { items: { folder: undefined; file: undefined } };

// The permission flags are part of the document, and the commands enforce them: `movable: false`
// keeps an item in place, `droppable: false` keeps a folder closed to drops. A drag asks
// `model.can("item.move", …)` for every target, so a refused one never shows.
const json: TreeJson<Types> = {
    version: 1,
    rootItemIds: ["src", "docs", "vendor", "license", "readme"],
    items: {
        src: {
            kind: "folder",
            label: "src",
            childItemIds: ["app", "main", "routes"],
        },
        app: { kind: "file", label: "app.tsx" },
        main: { kind: "file", label: "main.tsx" },
        routes: { kind: "folder", label: "routes", childItemIds: ["home"] },
        home: { kind: "file", label: "home.tsx" },
        docs: { kind: "folder", label: "docs", childItemIds: ["guide", "api"] },
        guide: { kind: "file", label: "guide.md" },
        api: { kind: "file", label: "api.md" },
        vendor: {
            kind: "folder",
            label: "vendor",
            droppable: false,
            childItemIds: ["polyfill"],
        },
        polyfill: { kind: "file", label: "polyfill.js", movable: false },
        license: { kind: "file", label: "LICENSE", movable: false },
        readme: { kind: "file", label: "README.md" },
    },
    expandedItemIds: ["src", "docs", "vendor"],
};

/** The live region's text for each step of a drag (pointer or keyboard): the package writes none. */
function announcer(model: TreeModel<Types>) {
    const label = (itemId: string | null) =>
        itemId === null
            ? "the tree"
            : (model.get("item-by", { id: itemId })?.label ?? itemId);
    const names = (itemIds: readonly string[]) =>
        itemIds.map((itemId) => label(itemId)).join(", ");
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

export default function DragAndDrop() {
    const [model] = useState(() =>
        createTreeModel<Types, typeof features>(json, { features }),
    );
    const [announce] = useState(() => announcer(model));
    // one description for every locked item, referenced by id (hidden, still read)
    const lockedId = useId();
    return (
        <div className={styles.frame}>
            <Tree.Root<Types, typeof features>
                model={model}
                announce={announce}
                aria-label="Project files"
                className={styles.root}
            >
                <Tree.Items<Types>>
                    {(item) => <FileItem item={item} lockedId={lockedId} />}
                </Tree.Items>
                {/* where the drop lands: a line before or after a row, or the box of a folder */}
                <DropIndicator className={styles.dropIndicator} />
                <Tree.LiveRegion className={styles.liveRegion} />
            </Tree.Root>
            <span id={lockedId} hidden>
                Locked
            </span>
            <p className={styles.hint}>
                Drag a row to reorder it or move it into a folder.{" "}
                <Lock aria-hidden className={styles.hintIcon} /> items stay in
                place; nothing can be dropped into vendor.
            </p>
        </div>
    );
}

function FileItem({
    item,
    lockedId,
}: {
    item: ItemOf<Types>;
    lockedId: string;
}) {
    const locked = item.movable === false || item.droppable === false;
    return (
        <Tree.Item
            item={item}
            aria-describedby={locked ? lockedId : undefined}
            className={styles.item}
        >
            <Tree.ItemContent className={styles.row}>
                <GripVertical aria-hidden className={styles.grip} />
                <Tree.Toggle className={styles.toggle}>
                    <ChevronRight aria-hidden />
                </Tree.Toggle>
                {item.kind === "folder" ? (
                    item.droppable === false ? (
                        <FolderLock aria-hidden className={styles.folderIcon} />
                    ) : (
                        <Folder aria-hidden className={styles.folderIcon} />
                    )
                ) : (
                    <File aria-hidden className={styles.fileIcon} />
                )}
                <span className={styles.label}>{item.label}</span>
                {item.movable === false && (
                    <Lock aria-hidden className={styles.lock} />
                )}
            </Tree.ItemContent>
            <Tree.Group<Types>>
                {(child) => <FileItem item={child} lockedId={lockedId} />}
            </Tree.Group>
        </Tree.Item>
    );
}
