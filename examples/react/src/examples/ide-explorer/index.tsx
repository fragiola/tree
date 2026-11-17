"use client";

import {
    type AnnounceEvent,
    type CommandError,
    createTreeModel,
    type ItemOf,
    Tree,
    useTree,
    useTreeRef,
    useTreeState,
} from "@fragiola/tree-react";
import { DropIndicator } from "@fragiola/tree-react/drag-and-drop";
import { useTreeItemRename } from "@fragiola/tree-react/rename";
import {
    ChevronRight,
    ChevronsDownUp,
    FilePlus,
    FolderPlus,
    GitBranch,
    LoaderCircle,
    LocateFixed,
    Trash2,
} from "lucide-react";
import {
    type ComponentProps,
    type KeyboardEvent,
    useEffect,
    useId,
    useState,
    useSyncExternalStore,
} from "react";
import { Clickable } from "#/components/atoms/clickable";
import { Editor } from "./editor";
import { FileIcon } from "./file-icon";
import {
    createPackageLoader,
    freeLabel,
    gitSummary,
    isManaged,
    type ProjectTypes,
    project,
    STATUS_LETTERS,
} from "./project";
import * as styles from "./styles";
import {
    createEditors,
    features,
    type ProjectModel,
    projectRules,
    reveal,
} from "./workspace";

let nextId = 0;

export default function IdeExplorer() {
    const [model] = useState(() =>
        createTreeModel<ProjectTypes, typeof features>(project(), { features }),
    );
    // node_modules is listed from disk the first time it is opened (a fake, here)
    const [loadChildren] = useState(() => createPackageLoader());
    // the open editors follow the model: selecting a file opens it, removing one closes it
    const [editors] = useState(() => createEditors(model));
    const tree = useTreeRef<ProjectTypes, typeof features>();
    const [announce] = useState(() => announcer(model));
    // the last thing the project refused, or did: shown in the status bar and announced
    const [notice, setNotice] = useState("");
    useEffect(() => projectRules(model), [model]);
    useEffect(() => editors.destroy, [editors]);

    const { activeFileId } = useSyncExternalStore(
        editors.subscribe,
        editors.get,
        editors.get,
    );
    const focusedId = useTreeState((state) => state.focusedItemId, { model });
    const selectedCount = useTreeState(
        (state) => state.selectedItemIds.length,
        { model },
    );
    const { counts } = useTreeState((_state, current) => gitSummary(current), {
        model,
    });

    const report = (error: CommandError | undefined) =>
        setNotice(error?.message ?? "");

    /** Adds a file or a folder where an editor does: inside the focused folder, or beside the focused file. */
    const create = (kind: "file" | "folder") => {
        const focused =
            focusedId === null
                ? undefined
                : model.get("item-by", { id: focusedId });
        const parentItemId =
            focused === undefined || isManaged(model, focused.id)
                ? null
                : focused.kind === "folder"
                  ? focused.id
                  : (model.get("item-parent-by", { itemId: focused.id })?.id ??
                    null);
        const id = `new-${nextId++}`;
        const label =
            kind === "file"
                ? freeLabel(model, parentItemId, "untitled", ".ts")
                : freeLabel(model, parentItemId, "folder");
        // one step: the folder opens, the item appears first in it, selected, and its name is edited
        const result = model.run("batch", {
            commands: [
                ...(parentItemId !== null &&
                !model.is("item-expanded", { itemId: parentItemId })
                    ? [
                          {
                              command: "item.expand" as const,
                              payload: { itemId: parentItemId },
                          },
                      ]
                    : []),
                {
                    command: "item.add",
                    payload: {
                        item:
                            kind === "file"
                                ? {
                                      id,
                                      kind,
                                      label,
                                      data: { status: "untracked" },
                                  }
                                : { id, kind, label, childItemIds: [] },
                        to: { parentItemId, index: 0 },
                    },
                },
                { command: "item.select", payload: { itemId: id } },
                { command: "item.focus", payload: { itemId: id } },
                { command: "item.start-rename", payload: { itemId: id } },
            ],
        });
        report(result.ok ? undefined : result.error);
    };

    const removeSelection = () => {
        const itemIds = [...model.state.selectedItemIds];
        if (itemIds.length === 0) return;
        const result = model.run("item.remove", { itemIds });
        setNotice(
            result.ok
                ? `Deleted ${itemIds.length === 1 ? "1 item" : `${itemIds.length} items`}.`
                : result.error.message,
        );
    };

    /** Reveal active file: its folders open (model), then it scrolls into view and takes focus (engine). */
    const revealActive = () => {
        if (activeFileId === null) return;
        reveal(model, activeFileId);
        const engine = tree.current?.engine;
        // the expanded folders render on the next frame; the engine scrolls to rendered rows only
        requestAnimationFrame(() => {
            engine?.run("scroll-to", { itemId: activeFileId, align: "center" });
            engine?.run("focus", { itemId: activeFileId });
        });
    };

    // the app's shortcut on the tree: Delete removes the selection (the tree's own keys run first)
    const onKeyDown = (event: KeyboardEvent) => {
        if (event.target instanceof HTMLInputElement) return;
        if (event.key !== "Delete") return;
        event.preventDefault();
        removeSelection();
    };

    return (
        <div className={styles.frame}>
            <div className={styles.body}>
                <section aria-label="Explorer" className={styles.sideBar}>
                    <div className={styles.sideBarHeader}>
                        <h2 className={styles.sideBarTitle}>Explorer</h2>
                        <ToolButton
                            label="New file"
                            onClick={() => create("file")}
                        >
                            <FilePlus aria-hidden />
                        </ToolButton>
                        <ToolButton
                            label="New folder"
                            onClick={() => create("folder")}
                        >
                            <FolderPlus aria-hidden />
                        </ToolButton>
                        <ToolButton
                            label="Reveal active file"
                            disabled={activeFileId === null}
                            onClick={revealActive}
                        >
                            <LocateFixed aria-hidden />
                        </ToolButton>
                        <ToolButton
                            label="Collapse folders"
                            onClick={() => model.run("tree.collapse-all", {})}
                        >
                            <ChevronsDownUp aria-hidden />
                        </ToolButton>
                        <ToolButton
                            label="Delete"
                            disabled={selectedCount === 0}
                            onClick={removeSelection}
                        >
                            <Trash2 aria-hidden />
                        </ToolButton>
                    </div>
                    <Tree.Root<ProjectTypes, typeof features>
                        model={model}
                        treeRef={tree}
                        loadChildren={loadChildren}
                        announce={announce}
                        expandOnClick
                        aria-label="Project files"
                        className={styles.root}
                        onKeyDown={onKeyDown}
                    >
                        <Tree.Items<ProjectTypes>>
                            {(item) => (
                                <ProjectItem
                                    item={item}
                                    onRenameError={report}
                                />
                            )}
                        </Tree.Items>
                        {/* where the drop lands: a line before or after a row, or the box of a folder */}
                        <DropIndicator className={styles.dropIndicator} />
                        <Tree.LiveRegion className={styles.liveRegion} />
                    </Tree.Root>
                </section>
                <Editor model={model} editors={editors} />
            </div>
            <footer className={styles.statusBar}>
                <span className={styles.statusItem}>
                    <GitBranch aria-hidden />
                    main
                </span>
                <span className={styles.statusItem} data-testid="changes">
                    {counts.modified} modified,{" "}
                    {counts.added + counts.untracked} new
                </span>
                <span className={styles.statusItem} data-testid="selection">
                    {selectedCount} selected
                </span>
                <span
                    role="status"
                    data-testid="notice"
                    className={styles.notice}
                >
                    {notice}
                </span>
            </footer>
        </div>
    );
}

function ToolButton({
    label,
    ...props
}: { label: string } & Omit<
    ComponentProps<typeof Clickable.Button>,
    "aria-label"
>) {
    return (
        <Clickable.Button
            variant="icon"
            shape="square"
            aria-label={label}
            title={label}
            className={styles.toolButton}
            {...props}
        />
    );
}

function ProjectItem({
    item,
    onRenameError,
}: {
    item: ItemOf<ProjectTypes>;
    onRenameError: (error: CommandError | undefined) => void;
}) {
    const { model } = useTree<ProjectTypes, typeof features>();
    // the app's own input edits the label: Enter commits, Escape cancels, a refused name stays open
    const rename = useTreeItemRename(item, { onRenameError });
    const loading = useTreeState<ProjectTypes, boolean, typeof features>(
        (_state, current) => current.is("item-loading", { itemId: item.id }),
    );
    // a folder holding a change gets a dot: derived from the files' status, once per state
    const changed = useTreeState<ProjectTypes, boolean>((_state, current) =>
        gitSummary(current).changedFolderIds.has(item.id),
    );
    const status = item.kind === "file" ? item.data.status : undefined;
    const statusId = useId();
    const managed = isManaged(model, item.id);
    return (
        <Tree.Item
            item={item}
            aria-describedby={status ? statusId : undefined}
            className={styles.item}
        >
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
                <FileIcon item={item} />
                <span className={styles.label({ status, managed })}>
                    {item.label}
                </span>
                {rename.state.renaming && (
                    <input
                        {...rename.props}
                        aria-label={`Rename ${item.label}`}
                        className={styles.input}
                        onChange={(event) => {
                            rename.props.onChange?.(event);
                            onRenameError(undefined);
                        }}
                    />
                )}
                {loading && (
                    <LoaderCircle aria-hidden className={styles.spinner} />
                )}
                {status && (
                    // the letter is for the eyes; the item is described by the status's word
                    <span
                        title={status}
                        aria-hidden
                        className={styles.status(status)}
                    >
                        {STATUS_LETTERS[status]}
                        <span id={statusId} hidden>
                            {status}
                        </span>
                    </span>
                )}
                {item.kind === "folder" && changed && (
                    <span
                        aria-hidden
                        data-testid="changed-folder"
                        className={styles.changedDot}
                    />
                )}
            </Tree.ItemContent>
            <Tree.Group<ProjectTypes>>
                {(child) => (
                    <ProjectItem item={child} onRenameError={onRenameError} />
                )}
            </Tree.Group>
        </Tree.Item>
    );
}

/** The live region's text: loads and drags (the package writes none). */
function announcer(model: ProjectModel) {
    const label = (itemId: string | null) =>
        itemId === null
            ? "the project"
            : (model.get("item-by", { id: itemId })?.label ?? itemId);
    return (event: AnnounceEvent): string | undefined => {
        switch (event.type) {
            case "load-error":
                return `Could not list ${label(event.itemId)}.`;
            case "drag-start":
                return `Picked up ${event.itemIds.map(label).join(", ")}.`;
            case "drop":
                return `Moved ${event.itemIds.map(label).join(", ")} ${
                    event.target.position === "inside"
                        ? `into ${label(event.target.itemId)}`
                        : `${event.target.position} ${label(event.target.itemId)}`
                }.`;
            case "drag-cancel":
                return "Move cancelled.";
            default:
                return undefined;
        }
    };
}
