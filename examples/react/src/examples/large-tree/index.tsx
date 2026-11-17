"use client";

import {
    type AnnounceEvent,
    createTreeModel,
    type DropTarget,
    type ItemOf,
    Tree,
    type TreeJson,
    type TreeModel,
    useTreeRef,
    useTreeState,
} from "@fragiola/tree-react";
import { DropIndicator, dragAndDrop } from "@fragiola/tree-react/drag-and-drop";
import { typeAhead } from "@fragiola/tree-react/type-ahead";
import {
    VirtualItems,
    virtualization,
} from "@fragiola/tree-react/virtualization";
import { ChevronRight, File, Folder } from "lucide-react";
import { useEffect, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import * as styles from "./styles";

type Types = { items: { folder: undefined; file: undefined } };

const FOLDERS = 1000;
const FILES = 100;

/** 1 000 folders of 100 files each: 101 000 items, every folder expanded. */
function largeTree(): TreeJson<Types> {
    const items: TreeJson<Types>["items"] = {};
    const rootItemIds: string[] = [];
    for (let f = 1; f <= FOLDERS; f++) {
        const folderId = `folder-${f}`;
        const childItemIds: string[] = [];
        for (let i = 1; i <= FILES; i++) {
            const fileId = `${folderId}-file-${i}`;
            childItemIds.push(fileId);
            items[fileId] = { kind: "file", label: `file ${f}.${i}.ts` };
        }
        rootItemIds.push(folderId);
        items[folderId] = {
            kind: "folder",
            label: `module ${f}`,
            childItemIds,
        };
    }
    return { version: 1, rootItemIds, items, expandedItemIds: rootItemIds };
}

// The virtualization feature: the engine renders only the rows in view, plus 10 on each side. Each
// theme sizes the rows, so they are measured (estimated at 28px until then). The type-ahead finds a
// row outside the window.
const features = [
    virtualization({ estimateRowSize: 28, overscan: 10 }),
    typeAhead(),
    dragAndDrop({ indicatorInset: styles.indicatorInset }),
] as const;

/** The live region's text for each step of a drag (pointer or keyboard): the package writes none. */
function announcer(model: TreeModel<Types>) {
    const label = (itemId: string | null) =>
        itemId === null
            ? "the tree"
            : (model.get("item-by", { id: itemId })?.label ?? itemId);
    const where = (target: DropTarget) =>
        target.position === "inside"
            ? `into ${label(target.itemId)}`
            : `${target.position} ${label(target.itemId)}`;
    return (event: AnnounceEvent): string | undefined => {
        switch (event.type) {
            case "drag-start":
                return event.target
                    ? `Picked up. Drop ${where(event.target)}.`
                    : "Picked up.";
            case "drag-over":
                return event.target
                    ? `Drop ${where(event.target)}.`
                    : undefined;
            case "drop":
                return `Moved ${where(event.target)}.`;
            case "drag-cancel":
                return "Cancelled.";
            default:
                return undefined;
        }
    };
}

export default function LargeTree() {
    const [model] = useState(() =>
        createTreeModel<Types, typeof features>(largeTree(), { features }),
    );
    const [announce] = useState(() => announcer(model));
    const tree = useTreeRef<Types, typeof features>();
    const visible = useTreeState(
        (_state, current) => current.get("visible-items").length,
        { model },
    );
    // how many rows the DOM holds: the engine's window, read again on a scroll (the engine's
    // listeners) and on a change of the tree (the model's)
    const [rendered, setRendered] = useState(0);
    const engine = tree.current?.engine;
    useEffect(() => {
        if (!engine) return;
        const read = () =>
            setRendered(engine.get("virtual-window")?.rows.length ?? 0);
        read();
        const stopEngine = engine.subscribe(read);
        const stopModel = model.subscribe(read);
        return () => {
            stopEngine();
            stopModel();
        };
    }, [engine, model]);
    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <Clickable.Button
                    variant="outline"
                    size="sm"
                    onClick={() => model.run("tree.expand-all", {})}
                >
                    Expand all
                </Clickable.Button>
                <Clickable.Button
                    variant="outline"
                    size="sm"
                    onClick={() => model.run("tree.collapse-all", {})}
                >
                    Collapse all
                </Clickable.Button>
                <span className={styles.count} data-testid="rendered">
                    {rendered.toLocaleString("en")} of{" "}
                    {visible.toLocaleString("en")} rows in the DOM
                </span>
            </div>
            <Tree.Root<Types, typeof features>
                model={model}
                treeRef={tree}
                announce={announce}
                aria-label="Large project"
                className={styles.root}
            >
                {/* flat rows: each item carries its level, position and set size */}
                <VirtualItems<Types>>
                    {(item) => <Row item={item} />}
                </VirtualItems>
                <DropIndicator className={styles.dropIndicator} />
                <Tree.LiveRegion className={styles.liveRegion} />
            </Tree.Root>
            <p className={styles.hint}>
                End, Home, PageDown and type-ahead reach any row; drag a row,
                the tree scrolls near its edges.
            </p>
        </div>
    );
}

/** A row: no Tree.Group, a virtualized tree is flat. */
function Row({ item }: { item: ItemOf<Types> }) {
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
            </Tree.ItemContent>
        </Tree.Item>
    );
}
