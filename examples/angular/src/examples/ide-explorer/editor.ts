import { Component, computed, effect, input, signal } from "@angular/core";
import { injectTreeState } from "@fragiola/tree-angular";
import { LucideChevronRight, LucideX } from "@lucide/angular";
import { FileIcon } from "./file-icon";
import { ancestorIds, CONTENTS } from "./project";
import * as styles from "./styles";
import type { Editors, EditorsStore, ProjectModel } from "./workspace";

/** The editor area: a tab per open file, the active file's path and its text. */
@Component({
    selector: "example-ide-explorer-editor",
    imports: [FileIcon, LucideChevronRight, LucideX],
    host: { class: "contents" },
    template: `
        <section aria-label="Editor" [class]="styles.editor">
            <!-- the open editors: a button shows a file (the one shown is the current one), another closes it -->
            <ul aria-label="Open editors" [class]="styles.tabList">
                @for (file of files(); track file.id) {
                    <li [attr.data-active]="file.id === editors().activeFileId ? '' : null" [class]="styles.tab">
                        <button
                            type="button"
                            [attr.aria-current]="file.id === editors().activeFileId ? 'true' : null"
                            [class]="styles.tabButton"
                            (click)="store().activate(file.id)"
                        >
                            <example-ide-explorer-file-icon [item]="file" />
                            {{ file.label }}
                        </button>
                        <button
                            type="button"
                            [attr.aria-label]="'Close ' + file.label"
                            [class]="styles.tabClose"
                            (click)="store().close(file.id)"
                        >
                            <svg lucideX aria-hidden="true"></svg>
                        </button>
                    </li>
                }
            </ul>
            @if (lines(); as lines) {
                <nav aria-label="Path" [class]="styles.breadcrumb">
                    @for (crumb of path(); track crumb.id; let first = $first) {
                        <span [class]="styles.crumb">
                            @if (!first) {
                                <svg lucideChevronRight aria-hidden="true"></svg>
                            }
                            {{ crumb.label }}
                        </span>
                    }
                </nav>
                <!-- the file's text, read-only, with line numbers (an app mounts its editor here) -->
                <pre data-testid="code" [class]="styles.code">@for (line of lines; track $index) {<span [class]="styles.line"><span aria-hidden="true" [class]="styles.lineNumber">{{ $index + 1 }}</span><span>{{ line }}</span></span>}</pre>
            } @else {
                <p [class]="styles.empty">Select a file in the explorer to open it.</p>
            }
        </section>
    `,
})
export class Editor {
    protected readonly styles = styles;
    readonly model = input.required<ProjectModel>();
    readonly store = input.required<EditorsStore>();
    protected readonly editors = signal<Editors>({
        openFileIds: [],
        activeFileId: null,
    });
    // the labels and the path come from the model: a rename or a move shows here at once
    private readonly state = injectTreeState((state) => state, {
        model: this.model,
    });
    protected readonly files = computed(() => {
        this.state();
        const model = this.model();
        return this.editors().openFileIds.flatMap(
            (id) => model.get("item-by", { id }) ?? [],
        );
    });
    protected readonly path = computed(() => {
        this.state();
        const model = this.model();
        const { activeFileId } = this.editors();
        return activeFileId === null
            ? []
            : [...ancestorIds(model, activeFileId), activeFileId].map((id) => ({
                  id,
                  label: model.get("item-by", { id })?.label ?? id,
              }));
    });
    protected readonly lines = computed(() => {
        const { activeFileId } = this.editors();
        if (activeFileId === null) return undefined;
        const text = CONTENTS[activeFileId] ?? "";
        return text === "" ? [""] : text.split("\n");
    });

    constructor() {
        // the open editors, as a signal that changes with them
        effect((onCleanup) => {
            const store = this.store();
            this.editors.set(store.get());
            onCleanup(store.subscribe(() => this.editors.set(store.get())));
        });
    }
}
