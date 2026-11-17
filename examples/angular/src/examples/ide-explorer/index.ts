import {
    Component,
    DestroyRef,
    inject,
    signal,
    viewChild,
} from "@angular/core";
import {
    type AnnounceEvent,
    type CommandError,
    createTreeModel,
    type ItemOf,
    injectTreeState,
    TREE,
    TreeRootDirective,
} from "@fragiola/tree-angular";
import { TreeDropIndicatorDirective } from "@fragiola/tree-angular/drag-and-drop";
import { TreeItemRenameDirective } from "@fragiola/tree-angular/rename";
import {
    LucideChevronRight,
    LucideChevronsDownUp,
    LucideFilePlus,
    LucideFolderPlus,
    LucideGitBranch,
    LucideLoaderCircle,
    LucideLocateFixed,
    LucideTrash2,
} from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
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
let nextInstance = 0;

@Component({
    selector: "example-ide-explorer",
    imports: [
        TREE,
        TreeDropIndicatorDirective,
        TreeItemRenameDirective,
        ClickableButton,
        Editor,
        FileIcon,
        LucideChevronRight,
        LucideChevronsDownUp,
        LucideFilePlus,
        LucideFolderPlus,
        LucideGitBranch,
        LucideLoaderCircle,
        LucideLocateFixed,
        LucideTrash2,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.body">
                <section aria-label="Explorer" [class]="styles.sideBar">
                    <div [class]="styles.sideBarHeader">
                        <h2 [class]="styles.sideBarTitle">Explorer</h2>
                        <button kitClickable variant="icon" shape="square" aria-label="New file" title="New file" [class]="styles.toolButton" (click)="create('file')">
                            <svg lucideFilePlus aria-hidden="true"></svg>
                        </button>
                        <button kitClickable variant="icon" shape="square" aria-label="New folder" title="New folder" [class]="styles.toolButton" (click)="create('folder')">
                            <svg lucideFolderPlus aria-hidden="true"></svg>
                        </button>
                        <button
                            kitClickable
                            variant="icon"
                            shape="square"
                            aria-label="Reveal active file"
                            title="Reveal active file"
                            [disabled]="activeFileId() === null"
                            [class]="styles.toolButton"
                            (click)="revealActive()"
                        >
                            <svg lucideLocateFixed aria-hidden="true"></svg>
                        </button>
                        <button
                            kitClickable
                            variant="icon"
                            shape="square"
                            aria-label="Collapse folders"
                            title="Collapse folders"
                            [class]="styles.toolButton"
                            (click)="model.run('tree.collapse-all', {})"
                        >
                            <svg lucideChevronsDownUp aria-hidden="true"></svg>
                        </button>
                        <button
                            kitClickable
                            variant="icon"
                            shape="square"
                            aria-label="Delete"
                            title="Delete"
                            [disabled]="selectedCount() === 0"
                            [class]="styles.toolButton"
                            (click)="removeSelection()"
                        >
                            <svg lucideTrash2 aria-hidden="true"></svg>
                        </button>
                    </div>
                    <div
                        [treeRoot]="model"
                        #tree="treeRoot"
                        [loadChildren]="loadChildren"
                        [announce]="announce"
                        expandOnClick
                        aria-label="Project files"
                        [class]="styles.root"
                        (keydown)="onKeyDown($event)"
                    >
                        <ng-template [treeItems]="model" let-item>
                            <div
                                [treeItem]="item"
                                #node="treeItem"
                                [attr.aria-describedby]="status(item) ? statusId(item.id) : null"
                                [class]="styles.item"
                            >
                                <!-- F2 is the tree's key; a double click is the app's, through the same command -->
                                <div
                                    treeItemContent
                                    [class]="styles.row"
                                    (dblclick)="model.run('item.start-rename', { itemId: item.id })"
                                >
                                    <span treeToggle [class]="styles.toggle">
                                        <svg lucideChevronRight aria-hidden="true"></svg>
                                    </span>
                                    <example-ide-explorer-file-icon [item]="item" [expanded]="node.state().expanded" />
                                    <span [class]="styles.label({ status: status(item), managed: managed(item.id) })">{{ item.label }}</span>
                                    <!-- the app's own input edits the label: Enter commits, Escape cancels, a
                                         refused name stays open -->
                                    @if (node.state().renaming) {
                                        <input
                                            treeItemRename
                                            [attr.aria-label]="'Rename ' + item.label"
                                            [class]="styles.input"
                                            (renameError)="report($event)"
                                            (input)="report(undefined)"
                                        />
                                    }
                                    @if (node.state().loading) {
                                        <svg lucideLoaderCircle aria-hidden="true" [class]="styles.spinner"></svg>
                                    }
                                    <!-- the letter is for the eyes; the item is described by the status's word -->
                                    @if (status(item); as status) {
                                        <span [title]="status" aria-hidden="true" [class]="styles.status(status)">
                                            {{ letters[status] }}
                                            <span [id]="statusId(item.id)" hidden>{{ status }}</span>
                                        </span>
                                    }
                                    <!-- a folder holding a change gets a dot: derived from the files' status, once per state -->
                                    @if (item.kind === "folder" && git().changedFolderIds.has(item.id)) {
                                        <span aria-hidden="true" data-testid="changed-folder" [class]="styles.changedDot"></span>
                                    }
                                </div>
                                <div treeGroup></div>
                            </div>
                        </ng-template>
                        <!-- where the drop lands: a line before or after a row, or the box of a folder,
                             there while a drag is under way -->
                        @if (tree.state().dragging) {
                            <div treeDropIndicator [class]="styles.dropIndicator"></div>
                        }
                        <div treeLiveRegion [class]="styles.liveRegion"></div>
                    </div>
                </section>
                <example-ide-explorer-editor [model]="model" [store]="editors" />
            </div>
            <footer [class]="styles.statusBar">
                <span [class]="styles.statusItem">
                    <svg lucideGitBranch aria-hidden="true"></svg>
                    main
                </span>
                <span [class]="styles.statusItem" data-testid="changes">
                    {{ git().counts.modified }} modified, {{ git().counts.added + git().counts.untracked }} new
                </span>
                <span [class]="styles.statusItem" data-testid="selection">{{ selectedCount() }} selected</span>
                <span role="status" data-testid="notice" [class]="styles.notice">{{ notice() }}</span>
            </footer>
        </div>
    `,
})
export default class IdeExplorer {
    protected readonly styles = styles;
    protected readonly letters = STATUS_LETTERS;
    // The model is the source of truth: create it once.
    protected readonly model = createTreeModel<ProjectTypes, typeof features>(
        project(),
        { features },
    );
    /** node_modules is listed from disk the first time it is opened (a fake, here) */
    protected readonly loadChildren = createPackageLoader();
    /** the open editors follow the model: selecting a file opens it, removing one closes it */
    protected readonly editors = createEditors(this.model);
    protected readonly announce = announcer(this.model);
    protected readonly activeFileId = signal(this.editors.get().activeFileId);
    protected readonly selectedCount = injectTreeState<
        ProjectTypes,
        number,
        typeof features
    >((state) => state.selectedItemIds.length, { model: this.model });
    /** the git summary, derived from the model once per state */
    protected readonly git = injectTreeState(
        (_state, current) => gitSummary(current),
        { model: this.model },
    );
    /** the last thing the project refused, or did: shown in the status bar and announced */
    protected readonly notice = signal("");
    private readonly instance = nextInstance++;
    private readonly root =
        viewChild.required<TreeRootDirective<ProjectTypes, typeof features>>(
            TreeRootDirective,
        );

    constructor() {
        const destroyRef = inject(DestroyRef);
        destroyRef.onDestroy(projectRules(this.model));
        destroyRef.onDestroy(this.editors.destroy);
        destroyRef.onDestroy(
            this.editors.subscribe(() =>
                this.activeFileId.set(this.editors.get().activeFileId),
            ),
        );
    }

    protected status(item: ItemOf<ProjectTypes>) {
        return item.kind === "file" ? item.data.status : undefined;
    }

    protected statusId(itemId: string) {
        return `ide-explorer-${this.instance}-status-${itemId}`;
    }

    protected managed(itemId: string) {
        return isManaged(this.model, itemId);
    }

    protected report(error: CommandError | undefined) {
        this.notice.set(error?.message ?? "");
    }

    /** Adds a file or a folder where an editor does: inside the focused folder, or beside the focused file. */
    protected create(kind: "file" | "folder") {
        const model = this.model;
        const { focusedItemId } = model.state;
        const focused =
            focusedItemId === null
                ? undefined
                : model.get("item-by", { id: focusedItemId });
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
        this.report(result.ok ? undefined : result.error);
    }

    protected removeSelection() {
        const itemIds = [...this.model.state.selectedItemIds];
        if (itemIds.length === 0) return;
        const result = this.model.run("item.remove", { itemIds });
        this.notice.set(
            result.ok
                ? `Deleted ${itemIds.length === 1 ? "1 item" : `${itemIds.length} items`}.`
                : result.error.message,
        );
    }

    /** Reveal active file: its folders open (model), then it scrolls into view and takes focus (engine). */
    protected revealActive() {
        const fileId = this.activeFileId();
        if (fileId === null) return;
        reveal(this.model, fileId);
        const { engine } = this.root();
        // the expanded folders render on the next frame; the engine scrolls to rendered rows only
        requestAnimationFrame(() => {
            engine.run("scroll-to", { itemId: fileId, align: "center" });
            engine.run("focus", { itemId: fileId });
        });
    }

    // the app's shortcut on the tree: Delete removes the selection (the tree's own keys run first)
    protected onKeyDown(event: KeyboardEvent) {
        if (event.target instanceof HTMLInputElement) return;
        if (event.key !== "Delete") return;
        event.preventDefault();
        this.removeSelection();
    }
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
