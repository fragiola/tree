import { Component, computed, DestroyRef, inject, signal } from "@angular/core";
import { createTreeModel, injectTreeState, TREE } from "@fragiola/tree-angular";
import { rename, TreeItemRenameDirective } from "@fragiola/tree-angular/rename";
import { selection } from "@fragiola/tree-angular/selection";

import {
    LucideChevronRight,
    LucideFile,
    LucideFolder,
    LucideRedo2,
    LucideTrash2,
    LucideUndo2,
} from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { type FileTypes, fileSystem } from "../_kit/data";
import { UndoManager } from "../_kit/undo";
import * as styles from "./styles";

/** The opt-in features of the model: the selection and the rename (F2). */
const features = [selection(), rename()] as const;

// Undo/redo is app code (`_kit/undo.ts`): it listens to the model's commits, keeps the document
// before each step, and puts it back with `tree.load`. The package ships no history.

/** What a step is called in the history list. */
const STEP_NAMES: Partial<Record<string, string>> = {
    "item.rename": "Rename",
    "item.remove": "Delete",
    "item.move": "Move",
    "item.expand": "Expand",
    "item.collapse": "Collapse",
    "item.toggle": "Expand or collapse",
};
const stepName = (command: string) => STEP_NAMES[command] ?? command;

@Component({
    selector: "example-undo-redo",
    imports: [
        TREE,
        TreeItemRenameDirective,
        ClickableButton,
        LucideChevronRight,
        LucideFile,
        LucideFolder,
        LucideRedo2,
        LucideTrash2,
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
                <button
                    kitClickable
                    variant="outline"
                    size="sm"
                    [class]="styles.deleteButton"
                    [disabled]="selected() === 0"
                    (click)="remove()"
                >
                    <svg lucideTrash2 aria-hidden="true"></svg>
                    Delete
                </button>
            </div>
            <div [class]="styles.body">
                <div
                    [treeRoot]="model"
                    [indicatorInset]="styles.indicatorInset"
                    aria-label="Project files"
                    [class]="styles.root"
                    (keydown)="onKeyDown($event)"
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
                <section aria-label="History" [class]="styles.history">
                    <h2 [class]="styles.historyTitle">History</h2>
                    <ol data-testid="history" [class]="styles.steps">
                        @if (snapshot().undoSteps.length + snapshot().redoSteps.length === 0) {
                            <li [class]="styles.empty">Rename (F2), drag or delete an item.</li>
                        }
                        @for (step of snapshot().undoSteps; track $index) {
                            <li [class]="styles.step">{{ stepName(step.command) }}</li>
                        }
                        @for (step of undone(); track $index) {
                            <li data-undone="" [class]="styles.step">{{ stepName(step.command) }}</li>
                        }
                    </ol>
                </section>
            </div>
        </div>
    `,
})
export default class UndoRedo {
    protected readonly styles = styles;
    protected readonly stepName = stepName;
    protected readonly model = createTreeModel<FileTypes, typeof features>(
        fileSystem(),
        { features },
    );
    protected readonly history = new UndoManager(this.model);
    /** the history's snapshot, as a signal that changes with it */
    protected readonly snapshot = signal(this.history.getSnapshot());
    /** redo goes forward through these: the next one is last */
    protected readonly undone = computed(() =>
        [...this.snapshot().redoSteps].reverse(),
    );
    protected readonly selected = injectTreeState<
        FileTypes,
        number,
        typeof features
    >((state) => state.selectedItemIds.length, { model: this.model });

    constructor() {
        inject(DestroyRef).onDestroy(
            this.history.subscribe(() =>
                this.snapshot.set(this.history.getSnapshot()),
            ),
        );
    }

    protected remove(): void {
        this.model.run("item.remove", {
            itemIds: [...this.model.state.selectedItemIds],
        });
    }

    // the app's shortcuts, on the tree: Ctrl/⌘+Z undoes, with Shift (or Ctrl+Y) redoes, Delete
    // removes the selection. The tree's own keys run first; these are not among them.
    protected onKeyDown(event: KeyboardEvent): void {
        // the rename input keeps its own Ctrl+Z (the text's undo) and Delete
        if (event.target instanceof HTMLInputElement) return;
        const mod = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();
        if (mod && key === "z")
            this.history[event.shiftKey ? "redo" : "undo"]();
        else if (mod && key === "y") this.history.redo();
        else if (event.key === "Delete" && this.selected() > 0) this.remove();
        else return;
        event.preventDefault();
    }
}
