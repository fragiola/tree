import { Component, computed, DestroyRef, inject, signal } from "@angular/core";
import {
    createTreeModel,
    injectTreeState,
    TREE,
    type TreeModel,
    validateTree,
} from "@fragiola/tree-angular";
import { rename, TreeItemRenameDirective } from "@fragiola/tree-angular/rename";
import { selection } from "@fragiola/tree-angular/selection";

import {
    LucideChevronRight,
    LucideFile,
    LucideFolder,
    LucideRotateCcw,
    LucideTrash2,
} from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { type FileTypes, fileSystem } from "../_kit/data";
import { persistTree, restoreTree } from "../_kit/persist";
import * as styles from "./styles";

/** The opt-in features of the model: the selection and the rename (F2). */
const features = [selection(), rename()] as const;

/** Where the document is saved: one key per tree. */
const STORAGE_KEY = "fragiola-tree:examples:save-restore";

/** A model of the saved document when there is a valid one, else of the default. */
function restore(): {
    model: TreeModel<FileTypes, typeof features>;
    restored: boolean;
} {
    const saved = restoreTree<FileTypes>(STORAGE_KEY);
    // a document saved by an older version of the app may no longer be valid
    const restored =
        saved !== undefined && validateTree(saved, { features }).length === 0;
    const json = restored ? saved : fileSystem();
    return {
        model: createTreeModel<FileTypes, typeof features>(json, { features }),
        restored,
    };
}

@Component({
    selector: "example-save-restore",
    imports: [
        TREE,
        TreeItemRenameDirective,
        ClickableButton,
        LucideChevronRight,
        LucideFile,
        LucideFolder,
        LucideRotateCcw,
        LucideTrash2,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <!-- the text alone, with no whitespace around it -->
                <p
                    role="status"
                    data-testid="save-status"
                    [class]="styles.status(savedAt() !== undefined)"
                >{{ status() }}</p>
                <button kitClickable variant="outline" size="sm" [disabled]="selected() === 0" (click)="remove()">
                    <svg lucideTrash2 aria-hidden="true"></svg>
                    Delete
                </button>
                <!-- tree.load replaces the whole document: the listener saves it too -->
                <button kitClickable variant="outline" size="sm" (click)="reset()">
                    <svg lucideRotateCcw aria-hidden="true"></svg>
                    Reset
                </button>
            </div>
            <div
                [treeRoot]="model"
                [indicatorInset]="styles.indicatorInset"
                aria-label="Project files"
                [class]="styles.root"
            >
                <ng-template [treeItems]="model" let-item>
                    <div [treeItem]="item" #node="treeItem" [class]="styles.item">
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
                            @if (node.state().renaming) {
                                <input treeItemRename [attr.aria-label]="'Rename ' + item.label" [class]="styles.input" />
                            }
                        </div>
                        <div treeGroup></div>
                    </div>
                </ng-template>
                <div treeDropIndicator [class]="styles.dropIndicator"></div>
            </div>
            <p [class]="styles.hint">
                Expand, drag, rename (F2) or delete, then reload: the tree comes
                back as you left it.
            </p>
        </div>
    `,
})
export default class SaveRestore {
    protected readonly styles = styles;
    private readonly restored = restore();
    protected readonly model = this.restored.model;
    protected readonly savedAt = signal<Date | undefined>(undefined);
    protected readonly selected = injectTreeState<
        FileTypes,
        number,
        typeof features
    >((state) => state.selectedItemIds.length, { model: this.model });
    protected readonly status = computed(() => {
        const savedAt = this.savedAt();
        if (savedAt) return `Saved at ${savedAt.toLocaleTimeString()}`;
        return this.restored.restored
            ? "Restored from this browser"
            : "Change the tree, then reload the page";
    });

    constructor() {
        // every committed change of the tree (an expansion, a rename, a move, a removal) is saved
        inject(DestroyRef).onDestroy(
            persistTree(this.model, STORAGE_KEY, () =>
                this.savedAt.set(new Date()),
            ),
        );
    }

    protected remove(): void {
        this.model.run("item.remove", {
            itemIds: [...this.model.state.selectedItemIds],
        });
    }

    protected reset(): void {
        this.model.run("tree.load", { json: fileSystem() });
    }
}
