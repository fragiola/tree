"use client";

import {
    type CommandError,
    createTreeModel,
    type ItemOf,
    Tree,
    type TreeModel,
    useTree,
    useTreeItemRename,
    veto,
} from "@fragiola/tree-react";
import { ChevronRight, File, Folder, FolderOpen } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { type FileTypes, fileSystem } from "../_kit/data";
import * as styles from "./styles";

/**
 * The app's naming rules, as a middleware: it sees every `item.rename` (from the input, a script,
 * an assistant) before it applies, trims the label, and vetoes a name the folder cannot take.
 */
function namingRules(model: TreeModel<FileTypes>) {
    return model.use((ctx, next) => {
        if (ctx.command !== "item.rename") return next();
        const label = ctx.payload.label.trim();
        if (label === "") return veto("A name cannot be empty.");
        if (label.includes("/")) return veto("A name cannot contain “/”.");
        const parent = ctx.get("item-parent-by", {
            itemId: ctx.payload.itemId,
        });
        const siblingIds = parent
            ? (parent.childItemIds ?? [])
            : ctx.state.rootItemIds;
        const taken = siblingIds.some(
            (id) =>
                id !== ctx.payload.itemId &&
                ctx.get("item-by", { id })?.label.toLowerCase() ===
                    label.toLowerCase(),
        );
        if (taken) return veto(`“${label}” is already in this folder.`);
        // a rewrite: the trimmed label is what gets saved
        ctx.payload = { ...ctx.payload, label };
        return next();
    });
}

export default function Rename() {
    const [model] = useState(() => createTreeModel<FileTypes>(fileSystem()));
    // the reason the last rename was refused, until the label changes or the rename ends
    const [error, setError] = useState<string>();
    const errorId = useId();
    useEffect(() => namingRules(model), [model]);
    useEffect(
        () =>
            model.subscribe((event) => {
                if (event.after.renamingItemId === null) setError(undefined);
            }),
        [model],
    );

    return (
        <div className={styles.frame}>
            <p className={styles.hint}>
                Press <kbd className={styles.kbd}>F2</kbd> or double-click a row
                to rename it; <kbd className={styles.kbd}>Enter</kbd> saves,{" "}
                <kbd className={styles.kbd}>Esc</kbd> cancels.
            </p>
            <Tree.Root<FileTypes>
                model={model}
                aria-label="Project files"
                className={styles.root}
            >
                <Tree.Items<FileTypes>>
                    {(item) => (
                        <FileItem
                            item={item}
                            errorId={errorId}
                            onError={(refused) => setError(refused.message)}
                            onEdit={() => setError(undefined)}
                        />
                    )}
                </Tree.Items>
            </Tree.Root>
            <p id={errorId} role="alert" className={styles.error}>
                {error}
            </p>
        </div>
    );
}

interface FileItemProps {
    item: ItemOf<FileTypes>;
    errorId: string;
    onError: (error: CommandError) => void;
    onEdit: () => void;
}

function FileItem({ item, ...props }: FileItemProps) {
    const { model } = useTree<FileTypes>();
    const { errorId, onError, onEdit } = props;
    // the rename wired onto the app's own input: it starts with the label, focused and selected;
    // Enter commits, Escape cancels, and a refused label keeps it open (`aria-invalid`)
    const rename = useTreeItemRename(item, { onRenameError: onError });
    return (
        <Tree.Item item={item} className={styles.item}>
            <Tree.ItemContent
                className={styles.row}
                // F2 is the tree's key; a double click is the app's, through the same command
                onDoubleClick={() =>
                    model.run("item.start-rename", { itemId: item.id })
                }
            >
                <Tree.Toggle className={styles.toggle}>
                    <ChevronRight aria-hidden />
                </Tree.Toggle>
                {item.kind === "folder" ? (
                    <>
                        <Folder aria-hidden className={styles.folderClosed} />
                        <FolderOpen aria-hidden className={styles.folderOpen} />
                    </>
                ) : (
                    <File aria-hidden className={styles.fileIcon} />
                )}
                <span className={styles.label}>{item.label}</span>
                {/* rendered only while this item is renaming */}
                {rename.state.renaming && (
                    <input
                        {...rename.props}
                        aria-label={`Rename ${item.label}`}
                        aria-describedby={errorId}
                        className={styles.input}
                        onChange={(event) => {
                            rename.props.onChange?.(event);
                            onEdit();
                        }}
                    />
                )}
            </Tree.ItemContent>
            <Tree.Group<FileTypes>>
                {(child) => <FileItem item={child} {...props} />}
            </Tree.Group>
        </Tree.Item>
    );
}
