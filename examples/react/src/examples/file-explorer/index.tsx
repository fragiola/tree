"use client";

import { type ItemOf, Tree, useTreeState } from "@fragiola/tree-react";
import { selection } from "@fragiola/tree-react/selection";
import {
    ChevronRight,
    File,
    FileCode,
    FileImage,
    FileJson,
    FileText,
    Folder,
    FolderOpen,
} from "lucide-react";
import { useId } from "react";
import { type FileTypes, fileSystem, formatSize } from "../_kit/data";
import * as styles from "./styles";

/** The opt-in features of the root's model: the selection. */
const features = [selection()];

// The kit's file system: folders, and files whose `data` is `{ size }` (typed by `FileTypes`).
const json = fileSystem();

export default function FileExplorer() {
    return (
        <div className={styles.frame}>
            {/* expandOnClick: a click on a folder's row also opens or closes it */}
            <Tree.Root<FileTypes>
                defaultTree={json}
                features={features}
                expandOnClick
                aria-label="Project files"
                className={styles.root}
            >
                <Tree.Items<FileTypes>>
                    {(item) => <FileItem item={item} />}
                </Tree.Items>
            </Tree.Root>
        </div>
    );
}

function FileItem({ item }: { item: ItemOf<FileTypes> }) {
    // the size is not part of the item's name (its row's text): it describes the item instead
    const sizeId = useId();
    const isFile = item.kind === "file";
    return (
        <Tree.Item
            item={item}
            aria-describedby={isFile ? sizeId : undefined}
            className={styles.item}
        >
            <Tree.ItemContent className={styles.row}>
                <Tree.Toggle className={styles.toggle}>
                    <ChevronRight aria-hidden />
                </Tree.Toggle>
                <ItemIcon item={item} />
                <span className={styles.label}>{item.label}</span>
                {item.kind === "file" && (
                    // `item.kind` narrows `item.data` to `{ size: number }`
                    <span id={sizeId} aria-hidden className={styles.size}>
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

/** A folder opens with its item; a file's icon follows its extension. */
function ItemIcon({ item }: { item: ItemOf<FileTypes> }) {
    const expanded = useTreeState<FileTypes, boolean>((_state, model) =>
        model.is("item-expanded", { itemId: item.id }),
    );
    if (item.kind === "folder") {
        const Icon = expanded ? FolderOpen : Folder;
        return <Icon aria-hidden className={styles.folderIcon} />;
    }
    const Icon = FILE_ICONS[extensionOf(item.label)] ?? File;
    return <Icon aria-hidden className={styles.fileIcon} />;
}

const FILE_ICONS: Record<string, typeof File> = {
    ts: FileCode,
    tsx: FileCode,
    json: FileJson,
    md: FileText,
    txt: FileText,
    svg: FileImage,
};

const extensionOf = (label: string) => label.split(".").pop() ?? "";
