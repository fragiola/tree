"use client";

import {
    type AnnounceEvent,
    createTreeModel,
    type ItemOf,
    Tree,
    type TreeJson,
    useTree,
    useTreeState,
} from "@fragiola/tree-react";
import {
    ChevronRight,
    CircleAlert,
    File,
    Folder,
    LoaderCircle,
    RotateCcw,
} from "lucide-react";
import { useId, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { type FileTypes, formatSize } from "../_kit/data";
import { createFakeLoader } from "../_kit/loader";
import * as styles from "./styles";

// Only the root folders are in the document: `childrenStatus: "unloaded"` says their children come
// from the app's `loadChildren`, called the first time each one is expanded.
const json: TreeJson<FileTypes> = {
    version: 1,
    rootItemIds: ["photos", "documents", "archive"],
    items: {
        photos: { kind: "folder", label: "Photos", childrenStatus: "unloaded" },
        documents: {
            kind: "folder",
            label: "Documents",
            childrenStatus: "unloaded",
        },
        archive: {
            kind: "folder",
            label: "Archive",
            childrenStatus: "unloaded",
        },
    },
};

export default function AsyncLoading() {
    const [model] = useState(() => createTreeModel<FileTypes>(json));
    // an app's loader fetches from its back-end; this fake answers after 500 ms, and fails the
    // first load of "documents"
    const [loadChildren] = useState(() =>
        createFakeLoader({ latency: 500, failOnce: ["documents"] }),
    );
    // the live region's text: the package writes none. Here, only a failed load is announced
    const announce = (event: AnnounceEvent) => {
        if (event.type !== "load-error") return undefined;
        const label = model.get("item-by", { id: event.itemId })?.label;
        return `Could not load ${label}. Use Retry to try again.`;
    };
    return (
        <div className={styles.frame}>
            <p className={styles.hint}>
                Open a folder: its contents come from the server. The first load
                of Documents fails.
            </p>
            <Tree.Root<FileTypes>
                model={model}
                loadChildren={loadChildren}
                announce={announce}
                expandOnClick
                aria-label="Cloud drive"
                className={styles.root}
            >
                <Tree.Items<FileTypes>>
                    {(item) => <DriveItem item={item} />}
                </Tree.Items>
                <Tree.LiveRegion className={styles.liveRegion} />
            </Tree.Root>
        </div>
    );
}

function DriveItem({ item }: { item: ItemOf<FileTypes> }) {
    const status = useTreeState<FileTypes, string | undefined>(
        (_state, model) => model.get("children-status-by", { itemId: item.id }),
    );
    // the size describes a file; the label alone is its accessible name
    const sizeId = useId();
    return (
        <Tree.Item
            item={item}
            aria-describedby={item.kind === "file" ? sizeId : undefined}
            className={styles.item}
        >
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
                    <span id={sizeId} aria-hidden className={styles.size}>
                        {formatSize(item.data.size)}
                    </span>
                )}
                {/* the item says `aria-busy` while loading; the spinner is for the eyes */}
                {status === "loading" && (
                    <LoaderCircle aria-hidden className={styles.spinner} />
                )}
                {status === "error" && (
                    <RetryButton itemId={item.id} label={item.label} />
                )}
            </Tree.ItemContent>
            <Tree.Group<FileTypes>>
                {(child) => <DriveItem item={child} />}
            </Tree.Group>
        </Tree.Item>
    );
}

/** A failed load stays `error` until the app loads it again: a screen action of the engine. */
function RetryButton({ itemId, label }: { itemId: string; label: string }) {
    const { engine } = useTree<FileTypes>();
    return (
        <span className={styles.error}>
            <CircleAlert aria-hidden className={styles.errorIcon} />
            <Clickable.Button
                variant="ghost"
                size="sm"
                className={styles.retry}
                aria-label={`Retry loading ${label}`}
                onClick={() => engine.run("load-children", { itemId })}
            >
                <RotateCcw aria-hidden />
                Retry
            </Clickable.Button>
        </span>
    );
}
