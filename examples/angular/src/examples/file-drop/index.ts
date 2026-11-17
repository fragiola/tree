import { Component, effect, signal, viewChild } from "@angular/core";
import {
    type AnnounceEvent,
    createTreeModel,
    type DropTarget,
    TREE,
    type TreeModel,
    TreeRootDirective,
} from "@fragiola/tree-angular";
import {
    dragAndDrop,
    TreeDropIndicatorDirective,
} from "@fragiola/tree-angular/drag-and-drop";
import { dropOutside } from "@fragiola/tree-angular/drop-outside";
import { foreignDrop } from "@fragiola/tree-angular/foreign-drop";
import {
    LucideChevronRight,
    LucideFile,
    LucideFolder,
    LucideTrash2,
    LucideUpload,
} from "@lucide/angular";
import { type FileTypes, fileSystem, formatSize } from "../_kit/data";
import * as styles from "./styles";

// Files from the desktop (or another window) dropped on the tree: the target shows as for a
// tree drag, and `onDrop` adds one item per file, from its name and size. The package reads no
// file and uploads nothing: what a drop does is the app's commands. Only the types are known
// before the drop, so `accept` takes a drag that carries files.
const files = foreignDrop<FileTypes>({
    accept: ({ types }) => types.includes("Files"),
    onDrop: ({ dataTransfer, to: { parentItemId, index }, model }) => {
        [...dataTransfer.files].forEach((file, i) => {
            model.run("item.add", {
                item: {
                    kind: "file",
                    label: file.name,
                    data: { size: file.size },
                },
                to: { parentItemId, index: index + i },
            });
        });
    },
});

// Rows dragged out of the tree: a release outside it goes to `onDrop`, with the element under the
// pointer. Over the trash it deletes them (`item.remove`); anywhere else it refuses, and the
// drag is cancelled.
const trash = dropOutside<FileTypes>({
    onDrop: ({ itemIds, element, model }) =>
        element?.closest("[data-trash]") != null &&
        model.run("item.remove", { itemIds: [...itemIds] }).ok,
});

/** The opt-in features of the model: the drags, the files dropped on it, the rows dropped outside. */
const features = [
    dragAndDrop({ indicatorInset: styles.indicatorInset }),
    files,
    trash,
] as const;

/** The live region's text for each step: the package writes none. */
function announcer(model: TreeModel<FileTypes>) {
    const label = (itemId: string | null) =>
        itemId === null
            ? "the project"
            : (model.get("item-by", { id: itemId })?.label ?? itemId);
    const where = (target: DropTarget) =>
        target.position === "inside"
            ? `into ${label(target.itemId)}`
            : `${target.position} ${label(target.itemId)}`;
    return (event: AnnounceEvent): string | undefined => {
        switch (event.type) {
            case "foreign-drag-over":
                return event.target
                    ? `Drop the files ${where(event.target)}.`
                    : "No place for files here.";
            case "foreign-drop":
                return `Added the files ${where(event.target)}.`;
            case "drag-start":
                return `Picked up ${event.itemIds.map(label).join(", ")}.`;
            case "drop":
                return `Moved ${where(event.target)}.`;
            case "drop-outside":
                return `Deleted ${event.itemIds.length} item${event.itemIds.length === 1 ? "" : "s"}.`;
            case "drag-cancel":
                return "Cancelled.";
            default:
                return undefined;
        }
    };
}

@Component({
    selector: "example-file-drop",
    imports: [
        TREE,
        TreeDropIndicatorDirective,
        LucideChevronRight,
        LucideFile,
        LucideFolder,
        LucideTrash2,
        LucideUpload,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div
                [treeRoot]="model"
                #tree="treeRoot"
                [announce]="announce"
                aria-label="Project files"
                [class]="styles.root"
            >
                <ng-template [treeItems]="model" let-item>
                    <div [treeItem]="item" [class]="styles.item">
                        <div treeItemContent [class]="styles.row">
                            <span treeToggle [class]="styles.toggle">
                                <svg lucideChevronRight aria-hidden="true"></svg>
                            </span>
                            @if (item.kind === "folder") {
                                <svg lucideFolder aria-hidden="true" [class]="styles.folderIcon"></svg>
                            } @else {
                                <svg lucideFile aria-hidden="true" [class]="styles.fileIcon"></svg>
                            }
                            <span [class]="styles.label">{{ item.label }}</span>
                            @if (item.kind === "file") {
                                <span aria-hidden="true" [class]="styles.size">
                                    {{ formatSize(item.data.size) }}
                                </span>
                            }
                        </div>
                        <div treeGroup></div>
                    </div>
                </ng-template>
                @if (tree.state().dragging) {
                    <div treeDropIndicator [class]="styles.dropIndicator"></div>
                }
                <div treeLiveRegion [class]="styles.liveRegion"></div>
            </div>
            <!-- the app's own target: data-trash is what onDrop looks for -->
            <div
                data-trash=""
                [attr.data-over]="overTrash() ? '' : null"
                data-testid="trash"
                [class]="styles.trash"
            >
                <svg lucideTrash2 aria-hidden="true" [class]="styles.trashIcon"></svg>
                Drag rows here to delete them
            </div>
            <p [class]="styles.hint">
                <svg lucideUpload aria-hidden="true" [class]="styles.hintIcon"></svg> Drop files
                from your computer into a folder: they are listed, not uploaded.
            </p>
        </div>
    `,
})
export default class FileDrop {
    protected readonly styles = styles;
    protected readonly formatSize = formatSize;
    // The model is the source of truth: create it once.
    protected readonly model = createTreeModel<FileTypes, typeof features>(
        fileSystem(),
        { features },
    );
    protected readonly announce = announcer(this.model);
    /** whether the tree's drag is over the trash */
    protected readonly overTrash = signal(false);
    private readonly root =
        viewChild.required<TreeRootDirective<FileTypes, typeof features>>(
            TreeRootDirective,
        );

    constructor() {
        // `drop-outside-element` is the element under the pointer while a drag is outside the
        // tree (the pointer stays captured by the row, so the trash gets no pointer events of its
        // own)
        effect((onCleanup) => {
            const { engine } = this.root();
            onCleanup(
                engine.subscribe(() =>
                    this.overTrash.set(
                        engine
                            .get("drop-outside-element")
                            ?.closest("[data-trash]") != null,
                    ),
                ),
            );
        });
    }
}
