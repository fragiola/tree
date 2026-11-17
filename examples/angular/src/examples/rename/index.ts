import { Component, DestroyRef, inject, signal } from "@angular/core";
import { createTreeModel, TREE } from "@fragiola/tree-angular";
import {
    type SelectionFeature,
    selection,
} from "@fragiola/tree-angular/selection";
import {
    LucideChevronRight,
    LucideFile,
    LucideFolder,
    LucideFolderOpen,
} from "@lucide/angular";
import { type FileTypes, fileSystem } from "../_kit/data";
import { namingRules } from "./naming-rules";
import * as styles from "./styles";

let nextId = 0;

@Component({
    selector: "example-rename",
    imports: [
        TREE,
        LucideChevronRight,
        LucideFile,
        LucideFolder,
        LucideFolderOpen,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <p [class]="styles.hint">
                Press <kbd [class]="styles.kbd">F2</kbd> or double-click a row
                to rename it; <kbd [class]="styles.kbd">Enter</kbd> saves,
                <kbd [class]="styles.kbd">Esc</kbd> cancels.
            </p>
            <div [treeRoot]="model" aria-label="Project files" [class]="styles.root">
                <ng-template [treeItems]="model" let-item>
                    <div [treeItem]="item" #node="treeItem" [class]="styles.item">
                        <!-- F2 is the tree's key; a double click is the app's, through the same command -->
                        <div
                            treeItemContent
                            [class]="styles.row"
                            (dblclick)="model.run('item.start-rename', { itemId: item.id })"
                        >
                            <span treeToggle [class]="styles.toggle">
                                <svg lucideChevronRight aria-hidden="true"></svg>
                            </span>
                            @if (item.kind === "folder") {
                                <svg lucideFolder aria-hidden="true" [class]="styles.folderClosed"></svg>
                                <svg lucideFolderOpen aria-hidden="true" [class]="styles.folderOpen"></svg>
                            } @else {
                                <svg lucideFile aria-hidden="true" [class]="styles.fileIcon"></svg>
                            }
                            <span [class]="styles.label">{{ item.label }}</span>
                            <!-- rendered only while this item is renaming; treeItemRename wires the
                                 app's own input: it starts with the label, focused and selected;
                                 Enter commits, Escape cancels, and a refused label keeps it open
                                 (aria-invalid) -->
                            @if (node.state().renaming) {
                                <input
                                    treeItemRename
                                    [attr.aria-label]="'Rename ' + item.label"
                                    [attr.aria-describedby]="errorId"
                                    [class]="styles.input"
                                    (renameError)="error.set($event.message)"
                                    (input)="error.set(undefined)"
                                />
                            }
                        </div>
                        <div treeGroup></div>
                    </div>
                </ng-template>
            </div>
            <p [id]="errorId" role="alert" [class]="styles.error">{{ error() }}</p>
        </div>
    `,
})
export default class Rename {
    protected readonly styles = styles;
    protected readonly model = createTreeModel<
        FileTypes,
        readonly [SelectionFeature]
    >(fileSystem(), { features: [selection()] });
    /** the reason the last rename was refused, until the label changes or the rename ends */
    protected readonly error = signal<string | undefined>(undefined);
    protected readonly errorId = `rename-error-${nextId++}`;

    constructor() {
        const destroyRef = inject(DestroyRef);
        destroyRef.onDestroy(namingRules(this.model));
        destroyRef.onDestroy(
            this.model.subscribe((event) => {
                if (event.after.renamingItemId === null)
                    this.error.set(undefined);
            }),
        );
    }
}
