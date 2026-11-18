// The task board's demo content and app logic, framework-free: the projects as a tree document
// (JSON v1), the structure rules as middleware, each task's status derived from its check, the
// board's columns, and the filters. The tree's state stays in the model.
import {
    type BatchEntry,
    type ItemOf,
    type TreeJson,
    type TreeModel,
    veto,
} from "@fragiola/tree-react";
import type { BoardModel } from "./model";

/** Where a task is. `done` is not stored: a task is done when it is checked. */
export type OpenStatus = "todo" | "doing" | "review";
export type Status = OpenStatus | "done";

export const STATUSES: readonly Status[] = ["todo", "doing", "review", "done"];

export const STATUS_NAMES: Record<Status, string> = {
    todo: "To do",
    doing: "Doing",
    review: "In review",
    done: "Done",
};

export type Priority = "low" | "medium" | "high" | "urgent";

export interface Person {
    id: string;
    name: string;
    initials: string;
}

export const PEOPLE: readonly Person[] = [
    { id: "ana", name: "Ana Lima", initials: "AL" },
    { id: "ben", name: "Ben Okafor", initials: "BO" },
    { id: "chen", name: "Chen Wei", initials: "CW" },
    { id: "dee", name: "Dee Ross", initials: "DR" },
];

export const personOf = (id: string | null) =>
    PEOPLE.find((person) => person.id === id);

/** The day the demo runs on: a task due before it is overdue (a fixed date, so the demo never ages). */
export const TODAY = "2026-11-17";

/** A task's work: its open status (the check says done), priority, assignee and due date. */
export interface Work {
    status: OpenStatus;
    priority: Priority;
    assigneeId: string | null;
    due: string | null;
}

/** The board's registry: projects hold epics, epics hold tasks, a task may hold subtasks. */
export type BoardTypes = {
    items: {
        project: { key: string };
        epic: undefined;
        task: Work;
        subtask: Work;
    };
};

type BoardItem = ItemOf<BoardTypes>;
type WorkItem = Extract<BoardItem, { kind: "task" | "subtask" }>;

const work = (
    status: OpenStatus,
    priority: Priority,
    assigneeId: string | null,
    due: string | null = null,
): Work => ({ status, priority, assigneeId, due });

/** Two projects, their epics, tasks and subtasks; the done ones checked. */
export function board(): TreeJson<BoardTypes> {
    return {
        version: 1,
        rootItemIds: ["web", "mobile"],
        items: {
            web: {
                kind: "project",
                label: "Website relaunch",
                data: { key: "WEB" },
                childItemIds: ["design-system", "checkout", "analytics"],
            },
            "design-system": {
                kind: "epic",
                label: "Design system",
                childItemIds: ["tokens", "button", "fields"],
            },
            tokens: {
                kind: "task",
                label: "Color tokens",
                data: work("review", "medium", "ana"),
            },
            button: {
                kind: "task",
                label: "Button component",
                data: work("doing", "high", "ana"),
                childItemIds: ["variants", "button-a11y"],
            },
            variants: {
                kind: "subtask",
                label: "Variants",
                data: work("doing", "medium", "ana"),
            },
            "button-a11y": {
                kind: "subtask",
                label: "Accessibility review",
                data: work("review", "high", "chen"),
            },
            fields: {
                kind: "task",
                label: "Form fields",
                data: work("todo", "medium", "ben", "2026-11-28"),
            },
            checkout: {
                kind: "epic",
                label: "Checkout",
                childItemIds: ["cart", "payment", "emails"],
            },
            cart: {
                kind: "task",
                label: "Cart page",
                data: work("review", "high", "ben"),
            },
            payment: {
                kind: "task",
                label: "Payment form",
                data: work("doing", "urgent", "chen"),
                childItemIds: ["card-validation", "three-ds"],
            },
            "card-validation": {
                kind: "subtask",
                label: "Card validation",
                data: work("todo", "high", "chen"),
            },
            "three-ds": {
                kind: "subtask",
                label: "3-D Secure",
                data: work("doing", "urgent", "dee", "2026-11-12"),
            },
            emails: {
                kind: "task",
                label: "Order emails",
                data: work("todo", "low", "dee", "2026-11-14"),
            },
            analytics: {
                kind: "epic",
                label: "Analytics",
                childItemIds: ["events", "dashboard"],
            },
            events: {
                kind: "task",
                label: "Event tracking",
                data: work("todo", "medium", null),
            },
            dashboard: {
                kind: "task",
                label: "Sales dashboard",
                data: work("todo", "low", "ana"),
            },
            mobile: {
                kind: "project",
                label: "Mobile app",
                data: { key: "MOB" },
                childItemIds: ["onboarding", "offline"],
            },
            onboarding: {
                kind: "epic",
                label: "Onboarding",
                childItemIds: ["welcome", "push"],
            },
            welcome: {
                kind: "task",
                label: "Welcome screens",
                data: work("review", "medium", "dee"),
            },
            push: {
                kind: "task",
                label: "Push permissions",
                data: work("todo", "high", "ben"),
            },
            offline: {
                kind: "epic",
                label: "Offline mode",
                childItemIds: ["sync-queue", "conflicts"],
            },
            "sync-queue": {
                kind: "task",
                label: "Sync queue",
                data: work("doing", "high", "chen", "2026-11-20"),
            },
            conflicts: {
                kind: "task",
                label: "Conflict resolution",
                data: work("todo", "medium", null),
            },
        },
        expandedItemIds: [
            "web",
            "design-system",
            "button",
            "checkout",
            "payment",
        ],
        selectedItemIds: ["web"],
        // done: checked. A parent is checked when all its work is, mixed when some is
        checkedItemIds: ["tokens", "variants", "cart", "welcome"],
        settings: { checkMode: "cascade" },
    };
}

const isWork = (item: BoardItem | undefined): item is WorkItem =>
    item?.kind === "task" || item?.kind === "subtask";

/** The leaves of an item's subtree that carry work: itself when it has no subtasks. */
export function workLeaves(
    model: TreeModel<BoardTypes>,
    itemId: string,
): WorkItem[] {
    const item = model.get("item-by", { id: itemId });
    if (!item) return [];
    const children = item.childItemIds ?? [];
    if (children.length === 0) return isWork(item) ? [item] : [];
    return children.flatMap((childId) => workLeaves(model, childId));
}

/**
 * A task's status: done when checked; otherwise its own status, or, for a task with subtasks,
 * "review" when all its open work is in review, "doing" once any of it has started or is done,
 * "todo" before.
 */
export function statusOf(model: BoardModel, itemId: string): Status {
    if (model.is("item-checked", { itemId })) return "done";
    const leaves = workLeaves(model, itemId);
    const item = model.get("item-by", { id: itemId });
    if (isWork(item) && leaves.length === 1 && leaves[0]?.id === itemId)
        return item.data.status;
    const open = leaves.filter(
        (leaf) => !model.is("item-checked", { itemId: leaf.id }),
    );
    // all its open work in review: the task is; any work started or done: doing; else to do
    if (open.length > 0 && open.every((leaf) => leaf.data.status === "review"))
        return "review";
    return open.length < leaves.length ||
        open.some((leaf) => leaf.data.status !== "todo")
        ? "doing"
        : "todo";
}

/** How much of an item's work is done: its leaves, checked or not. */
export function progressOf(model: BoardModel, itemId: string) {
    const leaves = workLeaves(model, itemId);
    return {
        done: leaves.filter((leaf) =>
            model.is("item-checked", { itemId: leaf.id }),
        ).length,
        total: leaves.length,
    };
}

export const isOverdue = (item: BoardItem) =>
    isWork(item) && item.data.due !== null && item.data.due < TODAY;

/** The ids among these that carry work (tasks and subtasks): a project or an epic has no status. */
export const workIdsOf = (
    model: TreeModel<BoardTypes>,
    itemIds: readonly string[],
) => itemIds.filter((id) => isWork(model.get("item-by", { id })));

/**
 * One step that moves work to a status: done checks it (the cascade checks its subtasks); an open
 * status unchecks it and sets that status on each of its leaves. One step, so one undo.
 */
export function setStatus(
    model: BoardModel,
    itemIds: readonly string[],
    status: Status,
) {
    const items = itemIds.flatMap((id) => {
        const item = model.get("item-by", { id });
        return isWork(item) ? [item] : [];
    });
    if (items.length === 0) return model.run("batch", { commands: [] });
    return model.run("batch", {
        commands: items.flatMap((item): BatchEntry<BoardTypes>[] =>
            status === "done"
                ? [
                      {
                          command: "item.check",
                          payload: { itemId: item.id, checked: true },
                      },
                  ]
                : [
                      {
                          command: "item.check",
                          payload: { itemId: item.id, checked: false },
                      },
                      ...workLeaves(model, item.id).map(
                          (leaf): BatchEntry<BoardTypes> => ({
                              command: "item.set-data",
                              payload: {
                                  itemId: leaf.id,
                                  data: { ...leaf.data, status },
                              },
                          }),
                      ),
                  ],
        ),
    });
}

/** Where each kind belongs: a task under an epic, a subtask under a task, an epic under a project. */
const PARENT_KINDS: Record<BoardItem["kind"], BoardItem["kind"] | null> = {
    project: null,
    epic: "project",
    task: "epic",
    subtask: "task",
};

const KIND_NAMES: Record<BoardItem["kind"], string> = {
    project: "A project",
    epic: "An epic",
    task: "A task",
    subtask: "A subtask",
};

/**
 * The board's structure, as one middleware: every move (a drag, a key, a script) passes here. A
 * refused move never shows as a drop target: a drag asks `model.can("item.move", …)` for each one.
 */
export function structureRules(model: TreeModel<BoardTypes>) {
    return model.use((ctx, next) => {
        if (ctx.command === "item.move") {
            const { parentItemId } = ctx.payload.to;
            const parentKind =
                parentItemId === null
                    ? null
                    : (ctx.get("item-by", { id: parentItemId })?.kind ?? null);
            const moving = new Set(ctx.payload.itemIds);
            for (const itemId of ctx.payload.itemIds) {
                // an item inside another moved one goes with it, where it is
                let parent = ctx.get("item-parent-by", { itemId });
                while (parent && !moving.has(parent.id))
                    parent = ctx.get("item-parent-by", { itemId: parent.id });
                if (parent) continue;
                const kind = ctx.get("item-by", { id: itemId })?.kind;
                if (kind === undefined) continue;
                const wanted = PARENT_KINDS[kind];
                if (wanted !== parentKind)
                    return veto(
                        wanted === null
                            ? `${KIND_NAMES[kind]} stays at the top.`
                            : `${KIND_NAMES[kind]} goes under ${KIND_NAMES[wanted].toLowerCase()}.`,
                    );
            }
        }
        return next();
    });
}

/** The project or epic the board shows: the selected one, the one around the selection, or the first project. */
export function scopeOf(model: BoardModel) {
    const [selectedId] = model.state.selectedItemIds;
    let item =
        selectedId === undefined
            ? undefined
            : model.get("item-by", { id: selectedId });
    while (item && item.kind !== "epic" && item.kind !== "project")
        item = model.get("item-parent-by", { itemId: item.id });
    return item ?? model.get("root-items")[0];
}

/** The board's cards: the tasks under the scope, by status. */
export function columnsOf(model: BoardModel) {
    const scope = scopeOf(model);
    const tasks: BoardItem[] = [];
    const visit = (itemId: string) => {
        const item = model.get("item-by", { id: itemId });
        if (!item) return;
        if (item.kind === "task") tasks.push(item);
        else for (const childId of item.childItemIds ?? []) visit(childId);
    };
    if (scope) visit(scope.id);
    return STATUSES.map((status) => ({
        status,
        cards: tasks.filter((task) => statusOf(model, task.id) === status),
    }));
}

/** The filters: an assignee and a status, either of them "any". */
export interface Filters {
    assigneeId: string;
    status: Status | "";
}

/** The work the filters match, and the folders around it: the rows to highlight. */
export function matchesOf(model: BoardModel, filters: Filters) {
    const matchIds = new Set<string>();
    const aroundIds = new Set<string>();
    if (filters.assigneeId === "" && filters.status === "")
        return { matchIds, aroundIds, active: false };
    for (const item of Object.values(model.state.items)) {
        if (!isWork(item)) continue;
        if (
            filters.assigneeId !== "" &&
            item.data.assigneeId !== filters.assigneeId
        )
            continue;
        if (
            filters.status !== "" &&
            statusOf(model, item.id) !== filters.status
        )
            continue;
        matchIds.add(item.id);
        let parent = model.get("item-parent-by", { itemId: item.id });
        while (parent) {
            aroundIds.add(parent.id);
            parent = model.get("item-parent-by", { itemId: parent.id });
        }
    }
    return { matchIds, aroundIds, active: true };
}

/** One step that expands the folders around every match. */
export function expandTo(model: BoardModel, itemIds: Iterable<string>) {
    return model.run("batch", {
        commands: [...itemIds]
            .filter((itemId) => !model.is("item-expanded", { itemId }))
            .map((itemId) => ({
                command: "item.expand" as const,
                payload: { itemId },
            })),
    });
}

let nextTask = 0;

/**
 * One step that adds a task where a planner does: last in the focused epic (or the epic around the
 * focused task), or after `afterItemId`; then selects it and starts its rename.
 */
export function addTask(model: BoardModel, afterItemId?: string) {
    let parentItemId: string | undefined;
    let index: number | undefined;
    if (afterItemId !== undefined) {
        const parent = model.get("item-parent-by", { itemId: afterItemId });
        parentItemId = parent?.id;
        index = (parent?.childItemIds ?? []).indexOf(afterItemId) + 1;
    } else {
        // the focused row, or else the selected one
        const fromId =
            model.state.focusedItemId ?? model.state.selectedItemIds[0] ?? null;
        let item =
            fromId === null ? undefined : model.get("item-by", { id: fromId });
        while (item && item.kind !== "epic" && item.kind !== "project")
            item = model.get("item-parent-by", { itemId: item.id });
        // a project: its first epic
        if (item?.kind === "project")
            item = model.get("item-by", { id: item.childItemIds?.[0] ?? "" });
        parentItemId = item?.kind === "epic" ? item.id : undefined;
        index = item?.childItemIds?.length ?? 0;
    }
    if (parentItemId === undefined) return undefined;
    const id = `new-task-${nextTask++}`;
    const result = model.run("batch", {
        commands: [
            ...(model.is("item-expanded", { itemId: parentItemId })
                ? []
                : [
                      {
                          command: "item.expand" as const,
                          payload: { itemId: parentItemId },
                      },
                  ]),
            {
                command: "item.add",
                payload: {
                    item: {
                        id,
                        kind: "task",
                        label: "New task",
                        data: work("todo", "medium", null),
                    },
                    to: { parentItemId, index: index ?? 0 },
                },
            },
            // a new task is not done, even in a done epic (the cascade would check it)
            { command: "item.check", payload: { itemId: id, checked: false } },
            { command: "item.select", payload: { itemId: id } },
            { command: "item.focus", payload: { itemId: id } },
            { command: "item.start-rename", payload: { itemId: id } },
        ],
    });
    return result.ok ? id : undefined;
}

/** A status from a column's `data-status-column`, or undefined. */
export const parseStatus = (
    value: string | null | undefined,
): Status | undefined => STATUSES.find((status) => status === value);

/** The status before and after one, along the board. */
export const neighbours = (status: Status) => {
    const index = STATUSES.indexOf(status);
    return { previous: STATUSES[index - 1], next: STATUSES[index + 1] };
};

/** The description of a row: its status, priority, assignee and due date, or its progress. */
export function describe(model: BoardModel, item: BoardItem) {
    if (item.kind === "project" || item.kind === "epic") {
        const { done, total } = progressOf(model, item.id);
        return `${done} of ${total} done`;
    }
    const status = STATUS_NAMES[statusOf(model, item.id)];
    const person = personOf(item.data.assigneeId)?.name ?? "unassigned";
    const parts = [status, `${item.data.priority} priority`, person];
    const { done, total } = progressOf(model, item.id);
    if (total > 1 || (item.childItemIds?.length ?? 0) > 0)
        parts.push(`${done} of ${total} done`);
    if (isOverdue(item) && statusOf(model, item.id) !== "done")
        parts.push(`overdue since ${item.data.due}`);
    return parts.join(", ");
}
