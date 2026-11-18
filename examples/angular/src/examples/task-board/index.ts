import { Component, DestroyRef, inject, signal } from "@angular/core";
import {
    type AnnounceEvent,
    type ItemOf,
    injectTreeState,
    TREE,
} from "@fragiola/tree-angular";
import { TreeDropIndicatorDirective } from "@fragiola/tree-angular/drag-and-drop";
import { TreeItemRenameDirective } from "@fragiola/tree-angular/rename";
import {
    LucideArrowDown,
    LucideArrowUp,
    LucideCalendarX,
    LucideCheck,
    LucideChevronRight,
    LucideChevronsUp,
    LucideCircle,
    LucideCircleCheck,
    LucideCircleDashed,
    LucideCircleDot,
    LucideFolderKanban,
    LucideLayers,
    LucideListTree,
    LucideMinus,
    LucidePlus,
    LucideRedo2,
    LucideUndo2,
} from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
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
    statusOf,
    structureRules,
} from "./board";
import { BoardView } from "./board-view";
import { type BoardModel, createBoardModel } from "./model";
import * as styles from "./styles";

let nextInstance = 0;

@Component({
    selector: "example-task-board",
    imports: [
        TREE,
        TreeDropIndicatorDirective,
        TreeItemRenameDirective,
        ClickableButton,
        BoardView,
        LucideArrowDown,
        LucideArrowUp,
        LucideCalendarX,
        LucideCheck,
        LucideChevronRight,
        LucideChevronsUp,
        LucideCircle,
        LucideCircleCheck,
        LucideCircleDashed,
        LucideCircleDot,
        LucideFolderKanban,
        LucideLayers,
        LucideListTree,
        LucideMinus,
        LucidePlus,
        LucideRedo2,
        LucideUndo2,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <button kitClickable variant="outline" size="sm" [disabled]="!snapshot().canUndo" (click)="history.undo()">
                    <svg lucideUndo2 aria-hidden="true"></svg>
                    Undo
                </button>
                <button kitClickable variant="outline" size="sm" [disabled]="!snapshot().canRedo" (click)="history.redo()">
                    <svg lucideRedo2 aria-hidden="true"></svg>
                    Redo
                </button>
                <button kitClickable variant="outline" size="sm" (click)="add()">
                    <svg lucidePlus aria-hidden="true"></svg>
                    Add task
                </button>
                <select #assignee aria-label="Filter by assignee" [class]="styles.select" (change)="setAssignee(assignee.value)">
                    <option value="" [selected]="filters().assigneeId === ''">Anyone</option>
                    @for (person of people; track person.id) {
                        <option [value]="person.id" [selected]="filters().assigneeId === person.id">{{ person.name }}</option>
                    }
                </select>
                <select #statusSelect aria-label="Filter by status" [class]="styles.select" (change)="setStatusFilter(statusSelect.value)">
                    <option value="" [selected]="filters().status === ''">Any status</option>
                    @for (status of statuses; track status) {
                        <option [value]="status" [selected]="filters().status === status">{{ names[status] }}</option>
                    }
                </select>
                @if (matches().active) {
                    <span [class]="styles.matches" data-testid="matches">
                        {{ matches().matchIds.size }} {{ matches().matchIds.size === 1 ? "match" : "matches" }}
                    </span>
                    <button kitClickable variant="outline" size="sm" (click)="expandTo(model, matches().aroundIds)">
                        <svg lucideListTree aria-hidden="true"></svg>
                        Expand to matches
                    </button>
                }
            </div>
            <div [class]="styles.body">
                <div
                    [treeRoot]="model"
                    #tree="treeRoot"
                    [announce]="announce"
                    aria-label="Projects"
                    [class]="styles.root"
                    (keydown)="onKeyDown($event)"
                >
                    <ng-template [treeItems]="model" let-item>
                        <!-- the filters' highlight is the app's: a data attribute its styles read -->
                        <div
                            [treeItem]="item"
                            #node="treeItem"
                            [attr.aria-describedby]="descriptionId(item.id)"
                            [attr.data-dimmed]="dimmed(item.id) ? '' : null"
                            [class]="styles.item"
                        >
                            <div
                                treeItemContent
                                [class]="styles.row"
                                (dblclick)="model.run('item.start-rename', { itemId: item.id })"
                            >
                                <span treeToggle [class]="styles.toggle">
                                    <svg lucideChevronRight aria-hidden="true"></svg>
                                </span>
                                <!-- the app's own check control: a press toggles the item's check (with the
                                     cascade): a checked task is done. The item carries aria-checked and Space
                                     toggles it, so the box is hidden and never takes focus; data-tree-no-drag
                                     keeps a press from dragging or selecting -->
                                <span
                                    aria-hidden="true"
                                    data-tree-no-drag=""
                                    data-testid="check"
                                    [attr.data-checked]="node.state().checked ? '' : null"
                                    [attr.data-indeterminate]="node.state().indeterminate ? '' : null"
                                    [class]="styles.checkbox"
                                    (click)="model.run('item.toggle-check', { itemId: item.id })"
                                >
                                    <svg lucideCheck aria-hidden="true" [class]="styles.checkIcon"></svg>
                                    <svg lucideMinus aria-hidden="true" [class]="styles.mixedIcon"></svg>
                                </span>
                                @switch (iconOf(item)) {
                                    @case ("project") { <svg lucideFolderKanban aria-hidden="true" [class]="styles.kindIcon.project"></svg> }
                                    @case ("epic") { <svg lucideLayers aria-hidden="true" [class]="styles.kindIcon.epic"></svg> }
                                    @case ("todo") { <svg lucideCircle aria-hidden="true" [class]="styles.statusIcon.todo"></svg> }
                                    @case ("doing") { <svg lucideCircleDashed aria-hidden="true" [class]="styles.statusIcon.doing"></svg> }
                                    @case ("review") { <svg lucideCircleDot aria-hidden="true" [class]="styles.statusIcon.review"></svg> }
                                    @default { <svg lucideCircleCheck aria-hidden="true" [class]="styles.statusIcon.done"></svg> }
                                }
                                <span [class]="styles.label">{{ item.label }}</span>
                                <!-- the app's own input edits the name: Enter commits, Escape cancels; a new
                                     task, named with Enter, adds the next one right after it -->
                                @if (node.state().renaming) {
                                    <input
                                        treeItemRename
                                        [attr.aria-label]="'Rename ' + item.label"
                                        [class]="styles.input"
                                        (keydown.enter)="addAfter(item.id)"
                                    />
                                }
                                <span [id]="descriptionId(item.id)" hidden>{{ description(item) }}</span>
                                @if (progress(item); as progress) {
                                    <span aria-hidden="true" [class]="styles.progress">{{ progress }}</span>
                                }
                                <!-- a task's marks, for the eyes (its description says them): overdue, priority, assignee -->
                                @if (item.kind === "task" || item.kind === "subtask") {
                                    @if (statusOf(item.id) !== "done" && isOverdue(item)) {
                                        <svg lucideCalendarX aria-hidden="true" [class]="styles.overdue"></svg>
                                    }
                                    @switch (item.data.priority) {
                                        @case ("urgent") { <svg lucideChevronsUp aria-hidden="true" [class]="styles.priority.urgent"></svg> }
                                        @case ("high") { <svg lucideArrowUp aria-hidden="true" [class]="styles.priority.high"></svg> }
                                        @case ("low") { <svg lucideArrowDown aria-hidden="true" [class]="styles.priority.low"></svg> }
                                        @default { <svg lucideMinus aria-hidden="true" [class]="styles.priority.medium"></svg> }
                                    }
                                    <span aria-hidden="true" [title]="person(item.data.assigneeId)?.name ?? 'Unassigned'" [class]="styles.avatar">
                                        {{ person(item.data.assigneeId)?.initials ?? "–" }}
                                    </span>
                                }
                            </div>
                            <div treeGroup></div>
                        </div>
                    </ng-template>
                    <!-- where the drop lands: a line before or after a row, or the box of a parent,
                         there while a drag is under way -->
                    @if (tree.state().dragging) {
                        <div treeDropIndicator [class]="styles.dropIndicator"></div>
                    }
                    <div treeLiveRegion [class]="styles.liveRegion"></div>
                </div>
                <example-task-board-columns [model]="model" [root]="tree" />
            </div>
        </div>
    `,
})
export default class TaskBoard {
    protected readonly styles = styles;
    protected readonly people = PEOPLE;
    protected readonly statuses = STATUSES;
    protected readonly names = STATUS_NAMES;
    protected readonly isOverdue = isOverdue;
    protected readonly expandTo = expandTo;
    protected readonly person = personOf;
    // The model is the source of truth: create it once.
    protected readonly model = createBoardModel();
    /** undo/redo is app code (`_kit/undo.ts`): every step, one command or one batch */
    protected readonly history = new UndoManager(this.model);
    protected readonly snapshot = signal(this.history.getSnapshot());
    protected readonly announce = announcer(this.model);
    /** the filters highlight the work they match; the tree is not filtered */
    protected readonly filters = signal<Filters>({
        assigneeId: "",
        status: "",
    });
    private readonly state = injectTreeState((state) => state, {
        model: this.model,
    });
    protected readonly matches = injectTreeState(
        (_state, current) => matchesOf(current, this.filters()),
        { model: this.model },
    );
    /** the tasks added from the toolbar: Enter on one, once named, adds the next */
    private readonly added = new Set<string>();
    private readonly instance = nextInstance++;

    constructor() {
        const destroyRef = inject(DestroyRef);
        destroyRef.onDestroy(structureRules(this.model));
        destroyRef.onDestroy(
            this.history.subscribe(() =>
                this.snapshot.set(this.history.getSnapshot()),
            ),
        );
    }

    protected descriptionId(itemId: string) {
        return `task-board-${this.instance}-description-${itemId}`;
    }

    protected statusOf(itemId: string) {
        this.state();
        return statusOf(this.model, itemId);
    }

    /** a project's or epic's icon, or a task's status */
    protected iconOf(item: ItemOf<BoardTypes>) {
        return item.kind === "project" || item.kind === "epic"
            ? item.kind
            : this.statusOf(item.id);
    }

    protected description(item: ItemOf<BoardTypes>) {
        this.state();
        return describe(this.model, item);
    }

    protected progress(item: ItemOf<BoardTypes>) {
        this.state();
        const { done, total } = progressOf(this.model, item.id);
        return item.kind === "project" ||
            item.kind === "epic" ||
            (item.childItemIds?.length ?? 0) > 0
            ? `${done}/${total}`
            : "";
    }

    protected dimmed(itemId: string) {
        const matches = this.matches();
        return (
            matches.active &&
            !matches.matchIds.has(itemId) &&
            !matches.aroundIds.has(itemId)
        );
    }

    protected setAssignee(assigneeId: string) {
        this.filters.update((filters) => ({ ...filters, assigneeId }));
    }

    protected setStatusFilter(value: string) {
        this.filters.update((filters) => ({
            ...filters,
            status: STATUSES.find((status) => status === value) ?? "",
        }));
    }

    protected add(afterItemId?: string) {
        const id = addTask(this.model, afterItemId);
        if (id) this.added.add(id);
    }

    protected addAfter(itemId: string) {
        queueMicrotask(() => {
            if (
                this.model.state.renamingItemId === null &&
                this.added.has(itemId)
            )
                this.add(itemId);
        });
    }

    // the app's shortcuts on the tree: Ctrl/⌘+Z undoes, with Shift (or Ctrl+Y) redoes
    protected onKeyDown(event: KeyboardEvent) {
        if (event.target instanceof HTMLInputElement) return;
        const mod = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();
        if (mod && key === "z")
            this.history[event.shiftKey ? "redo" : "undo"]();
        else if (mod && key === "y") this.history.redo();
        else return;
        event.preventDefault();
    }
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
