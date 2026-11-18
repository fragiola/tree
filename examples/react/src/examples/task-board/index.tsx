"use client";

import {
    type AnnounceEvent,
    type ItemOf,
    Tree,
    useTree,
    useTreeItem,
    useTreeRef,
    useTreeState,
} from "@fragiola/tree-react";
import { DropIndicator } from "@fragiola/tree-react/drag-and-drop";
import { useTreeItemRename } from "@fragiola/tree-react/rename";
import {
    ArrowDown,
    ArrowUp,
    CalendarX,
    Check,
    ChevronRight,
    ChevronsUp,
    Circle,
    CircleCheck,
    CircleDashed,
    CircleDot,
    FolderKanban,
    Layers,
    ListTree,
    Minus,
    Plus,
    Redo2,
    Undo2,
} from "lucide-react";
import {
    type KeyboardEvent,
    useEffect,
    useId,
    useState,
    useSyncExternalStore,
} from "react";
import { Clickable } from "#/components/atoms/clickable";
import { UndoManager } from "../_kit/undo";
import {
    addTask,
    type BoardTypes,
    describe,
    expandTo,
    type Filters,
    isOverdue,
    matchesOf,
    PEOPLE,
    personOf,
    progressOf,
    STATUS_NAMES,
    STATUSES,
    type Status,
    statusOf,
    structureRules,
} from "./board";
import { BoardView } from "./board-view";
import { type BoardFeatures, type BoardModel, createBoardModel } from "./model";
import * as styles from "./styles";

const STATUS_ICONS: Record<Status, typeof Circle> = {
    todo: Circle,
    doing: CircleDashed,
    review: CircleDot,
    done: CircleCheck,
};

const PRIORITY_ICONS = {
    low: ArrowDown,
    medium: Minus,
    high: ArrowUp,
    urgent: ChevronsUp,
} as const;

export default function TaskBoard() {
    const [model] = useState(createBoardModel);
    // undo/redo is app code (`_kit/undo.ts`): every step, one command or one batch
    const [history] = useState(() => new UndoManager(model));
    const [announce] = useState(() => announcer(model));
    const tree = useTreeRef<BoardTypes, BoardFeatures>();
    useEffect(() => structureRules(model), [model]);
    const { canUndo, canRedo } = useSyncExternalStore(
        history.subscribe,
        history.getSnapshot,
        history.getSnapshot,
    );
    // the filters highlight the work they match; the tree is not filtered
    const [filters, setFilters] = useState<Filters>({
        assigneeId: "",
        status: "",
    });
    const matches = useTreeState(
        (_state, current) => matchesOf(current, filters),
        {
            model,
        },
    );
    // the tasks added from the toolbar: Enter on one, once named, adds the next
    const [added] = useState(() => new Set<string>());

    const add = (afterItemId?: string) => {
        const id = addTask(model, afterItemId);
        if (id) added.add(id);
    };

    // the app's shortcuts on the tree: Ctrl/⌘+Z undoes, with Shift (or Ctrl+Y) redoes
    const onKeyDown = (event: KeyboardEvent) => {
        if (event.target instanceof HTMLInputElement) return;
        const mod = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();
        if (mod && key === "z") history[event.shiftKey ? "redo" : "undo"]();
        else if (mod && key === "y") history.redo();
        else return;
        event.preventDefault();
    };

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <Clickable.Button
                    variant="outline"
                    size="sm"
                    disabled={!canUndo}
                    onClick={() => history.undo()}
                >
                    <Undo2 aria-hidden />
                    Undo
                </Clickable.Button>
                <Clickable.Button
                    variant="outline"
                    size="sm"
                    disabled={!canRedo}
                    onClick={() => history.redo()}
                >
                    <Redo2 aria-hidden />
                    Redo
                </Clickable.Button>
                <Clickable.Button
                    variant="outline"
                    size="sm"
                    onClick={() => add()}
                >
                    <Plus aria-hidden />
                    Add task
                </Clickable.Button>
                <select
                    aria-label="Filter by assignee"
                    value={filters.assigneeId}
                    className={styles.select}
                    onChange={(event) =>
                        setFilters({
                            ...filters,
                            assigneeId: event.target.value,
                        })
                    }
                >
                    <option value="">Anyone</option>
                    {PEOPLE.map((person) => (
                        <option key={person.id} value={person.id}>
                            {person.name}
                        </option>
                    ))}
                </select>
                <select
                    aria-label="Filter by status"
                    value={filters.status}
                    className={styles.select}
                    onChange={(event) =>
                        setFilters({
                            ...filters,
                            status:
                                STATUSES.find(
                                    (status) => status === event.target.value,
                                ) ?? "",
                        })
                    }
                >
                    <option value="">Any status</option>
                    {STATUSES.map((status) => (
                        <option key={status} value={status}>
                            {STATUS_NAMES[status]}
                        </option>
                    ))}
                </select>
                {matches.active && (
                    <>
                        <span className={styles.matches} data-testid="matches">
                            {matches.matchIds.size}{" "}
                            {matches.matchIds.size === 1 ? "match" : "matches"}
                        </span>
                        <Clickable.Button
                            variant="outline"
                            size="sm"
                            onClick={() => expandTo(model, matches.aroundIds)}
                        >
                            <ListTree aria-hidden />
                            Expand to matches
                        </Clickable.Button>
                    </>
                )}
            </div>
            <div className={styles.body}>
                <Tree.Root<BoardTypes, BoardFeatures>
                    model={model}
                    treeRef={tree}
                    announce={announce}
                    aria-label="Projects"
                    className={styles.root}
                    onKeyDown={onKeyDown}
                >
                    <Tree.Items<BoardTypes>>
                        {(item) => (
                            <WorkItem
                                item={item}
                                matches={matches}
                                onAddAfter={(itemId) =>
                                    added.has(itemId) && add(itemId)
                                }
                            />
                        )}
                    </Tree.Items>
                    {/* where the drop lands: a line before or after a row, or the box of a parent */}
                    <DropIndicator className={styles.dropIndicator} />
                    <Tree.LiveRegion className={styles.liveRegion} />
                </Tree.Root>
                <BoardView model={model} tree={tree} />
            </div>
        </div>
    );
}

interface WorkItemProps {
    item: ItemOf<BoardTypes>;
    matches: ReturnType<typeof matchesOf>;
    onAddAfter: (itemId: string) => void;
}

/** A row: the check (done), the kind or status, the name, then priority, assignee, due date or progress. */
function WorkItem({ item, matches, onAddAfter }: WorkItemProps) {
    const { model } = useTree<BoardTypes, BoardFeatures>();
    // the app's own input edits the name: Enter commits, Escape cancels
    const rename = useTreeItemRename(item);
    // the row's status and description, read from the model (a check or a subtask changes them)
    const status = useTreeState<BoardTypes, Status, BoardFeatures>(
        (_state, current) => statusOf(current, item.id),
    );
    const description = useTreeState<BoardTypes, string, BoardFeatures>(
        (_state, current) => describe(current, item),
    );
    const progress = useTreeState<BoardTypes, string, BoardFeatures>(
        (_state, current) => {
            const { done, total } = progressOf(current, item.id);
            return item.kind === "project" ||
                item.kind === "epic" ||
                (item.childItemIds?.length ?? 0) > 0
                ? `${done}/${total}`
                : "";
        },
    );
    const descriptionId = useId();
    const dimmed =
        matches.active &&
        !matches.matchIds.has(item.id) &&
        !matches.aroundIds.has(item.id);
    const StatusIcon = STATUS_ICONS[status];
    return (
        <Tree.Item
            item={item}
            aria-describedby={descriptionId}
            // the filters' highlight is the app's: a data attribute its styles read
            data-dimmed={dimmed ? "" : undefined}
            className={styles.item}
        >
            <Tree.ItemContent
                className={styles.row}
                onDoubleClick={() =>
                    model.run("item.start-rename", { itemId: item.id })
                }
            >
                <Tree.Toggle className={styles.toggle}>
                    <ChevronRight aria-hidden />
                </Tree.Toggle>
                <CheckControl item={item} />
                {item.kind === "project" ? (
                    <FolderKanban
                        aria-hidden
                        className={styles.kindIcon.project}
                    />
                ) : item.kind === "epic" ? (
                    <Layers aria-hidden className={styles.kindIcon.epic} />
                ) : (
                    <StatusIcon
                        aria-hidden
                        className={styles.statusIcon[status]}
                    />
                )}
                <span className={styles.label}>{item.label}</span>
                {rename.state.renaming && (
                    <input
                        {...rename.props}
                        aria-label={`Rename ${item.label}`}
                        className={styles.input}
                        onKeyDown={(event) => {
                            rename.props.onKeyDown?.(event);
                            // a new task, named with Enter: the next one, right after it
                            if (event.key === "Enter")
                                queueMicrotask(() => {
                                    if (model.state.renamingItemId === null)
                                        onAddAfter(item.id);
                                });
                        }}
                    />
                )}
                <span id={descriptionId} hidden>
                    {description}
                </span>
                {progress !== "" && (
                    <span aria-hidden className={styles.progress}>
                        {progress}
                    </span>
                )}
                {(item.kind === "task" || item.kind === "subtask") && (
                    <WorkMeta item={item} done={status === "done"} />
                )}
            </Tree.ItemContent>
            <Tree.Group<BoardTypes>>
                {(child) => (
                    <WorkItem
                        item={child}
                        matches={matches}
                        onAddAfter={onAddAfter}
                    />
                )}
            </Tree.Group>
        </Tree.Item>
    );
}

/** A task's marks, for the eyes (its description says them): overdue, priority, assignee. */
function WorkMeta({
    item,
    done,
}: {
    item: Extract<ItemOf<BoardTypes>, { kind: "task" | "subtask" }>;
    done: boolean;
}) {
    const PriorityIcon = PRIORITY_ICONS[item.data.priority];
    const person = personOf(item.data.assigneeId);
    return (
        <>
            {!done && isOverdue(item) && (
                <CalendarX aria-hidden className={styles.overdue} />
            )}
            <PriorityIcon
                aria-hidden
                className={styles.priority[item.data.priority]}
            />
            <span
                aria-hidden
                title={person?.name ?? "Unassigned"}
                className={styles.avatar}
            >
                {person?.initials ?? "–"}
            </span>
        </>
    );
}

/**
 * The app's own check control: a press toggles the item's check (`item.toggle-check`, with the
 * cascade): a checked task is done. The item carries `aria-checked` and Space toggles it, so the box
 * is hidden from assistive technology and never takes focus; `data-tree-no-drag` keeps a press from
 * dragging or selecting.
 */
function CheckControl({ item }: { item: ItemOf<BoardTypes> }) {
    const { model } = useTree<BoardTypes, BoardFeatures>();
    const { state } = useTreeItem(item);
    return (
        <span
            aria-hidden
            data-tree-no-drag=""
            data-testid="check"
            data-checked={state.checked ? "" : undefined}
            data-indeterminate={state.indeterminate ? "" : undefined}
            className={styles.checkbox}
            onClick={() => model.run("item.toggle-check", { itemId: item.id })}
        >
            <Check aria-hidden className={styles.checkIcon} />
            <Minus aria-hidden className={styles.mixedIcon} />
        </span>
    );
}

/** The live region's text: drags inside the tree and onto the board (the package writes none). */
function announcer(model: BoardModel) {
    const label = (itemId: string | null) =>
        itemId === null
            ? "the top"
            : (model.get("item-by", { id: itemId })?.label ?? itemId);
    const names = (itemIds: readonly string[]) => itemIds.map(label).join(", ");
    return (event: AnnounceEvent): string | undefined => {
        switch (event.type) {
            case "drag-start":
                return `Picked up ${names(event.itemIds)}. Drop it in the tree, or on a board column.`;
            case "drop":
                return `Moved ${names(event.itemIds)} ${
                    event.target.position === "inside"
                        ? `into ${label(event.target.itemId)}`
                        : `${event.target.position} ${label(event.target.itemId)}`
                }.`;
            case "drop-outside":
                return `${names(event.itemIds)}: ${STATUS_NAMES[statusOf(model, event.itemIds[0] ?? "")]}.`;
            case "drag-cancel":
                return "Move cancelled.";
            default:
                return undefined;
        }
    };
}
