import {
    afterNextRender,
    computed,
    Directive,
    effect,
    Injector,
    inject,
    output,
    type Signal,
    signal,
    untracked,
} from "@angular/core";
import type { CommandError } from "@fragiola/tree";
import { injectItemContext, injectTreeContext } from "../context";
import { injectHost } from "../utils/helpers";

/** What `[treeItemRename]` says about its item's rename. */
export interface TreeItemRenameState {
    /** the item's label is being edited (`item.start-rename`, F2): render your editor */
    renaming: boolean;
    /** the last commit was refused (an empty label, a middleware's veto) */
    invalid: boolean;
    /** why the last commit was refused */
    error: CommandError | undefined;
}

/**
 * An item's rename, wired onto an input of yours: no element of its own, and it hides nothing.
 * Render your input only while the item is renaming and give it an accessible name:
 *
 * ```html
 * @if (item.state().renaming) {
 *     <input treeItemRename aria-label="Name" (renameError)="onError($event)" />
 * }
 * ```
 *
 * A rename starts it with the label, focused and selected. Enter commits (a refused label keeps it
 * open, `aria-invalid` and `data-invalid`, and emits `(renameError)`), Escape cancels, and leaving
 * it commits (or cancels when refused). Committing and cancelling go through
 * `engine.run("commit-rename" | "cancel-rename")`, which you can call yourself instead; focus goes
 * back to the item.
 */
@Directive({
    selector: "input[treeItemRename]",
    exportAs: "treeItemRename",
    host: {
        "[attr.aria-invalid]": "state().invalid ? 'true' : null",
        "[attr.data-invalid]": "state().invalid ? '' : null",
        "(keydown)": "onKeyDown($event)",
        "(blur)": "onBlur()",
        "(input)": "onInput()",
    },
})
export class TreeItemRenameDirective {
    /** a commit was refused (Enter on an empty label, a middleware's veto) */
    readonly renameError = output<CommandError>();

    private readonly context = injectTreeContext("[treeItemRename]");
    private readonly item = injectItemContext("[treeItemRename]");
    private readonly input = injectHost() as HTMLInputElement;
    private readonly injector = inject(Injector);
    private readonly error = signal<CommandError | undefined>(undefined);
    /**
     * this rename is over (committed or cancelled): the item taking focus back blurs the input,
     * and that blur must not commit a second time
     */
    private done = true;

    private readonly renaming = computed(() => this.item.state().renaming);

    /** the item's rename, and the last refused commit */
    readonly state: Signal<TreeItemRenameState> = computed(() => {
        const error = this.error();
        return {
            renaming: this.renaming(),
            invalid: error !== undefined,
            error,
        };
    });

    constructor() {
        // a rename (the one under way when the input is created, or a later one when the app
        // keeps it): it starts with the label, focused and selected once it is rendered
        effect(() => {
            if (!this.renaming()) {
                this.done = true;
                return;
            }
            untracked(() => {
                this.done = false;
                this.error.set(undefined);
                this.input.value = this.item.item().label;
                afterNextRender(
                    () => {
                        if (this.done || !this.input.isConnected) return;
                        this.input.focus({ preventScroll: true });
                        this.input.select();
                    },
                    { injector: this.injector },
                );
            });
        });
    }

    /** `focus: false` on a blur: focus went elsewhere, and stays there */
    private commit(focus: boolean): boolean {
        const engine = this.context.engine();
        if (this.done || !engine) return true;
        this.done = true;
        const result = engine.run("commit-rename", {
            itemId: this.item.item().id,
            label: this.input.value,
            focus,
        });
        if (result.ok) return true;
        this.done = false;
        this.error.set(result.error);
        this.renameError.emit(result.error);
        return false;
    }

    private cancel(focus: boolean): void {
        const engine = this.context.engine();
        if (this.done || !engine) return;
        this.done = true;
        engine.run("cancel-rename", { itemId: this.item.item().id, focus });
    }

    protected onKeyDown(event: KeyboardEvent): void {
        if (event.key === "Enter") {
            event.preventDefault();
            this.commit(true);
        } else if (event.key === "Escape") {
            event.preventDefault();
            this.cancel(true);
        }
    }

    protected onBlur(): void {
        if (!this.done && !this.commit(false)) this.cancel(false);
    }

    protected onInput(): void {
        if (untracked(this.error)) this.error.set(undefined);
    }
}
