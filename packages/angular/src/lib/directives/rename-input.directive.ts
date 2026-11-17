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
import { bindStructuralStyle, injectHost } from "../utils/helpers";
import {
    ITEM_DATA_HOST,
    itemData,
    type TreeItemState,
} from "../utils/item-state";

export interface RenameInputState extends TreeItemState {
    /** the last commit was refused (an empty label, a middleware's veto) */
    invalid: boolean;
    /** why the last commit was refused */
    error: CommandError | undefined;
}

/**
 * The enclosing item's label editor: `<input treeRenameInput aria-label="Name" />`, shown only
 * while the item is renaming (`item.start-rename`, F2; hidden otherwise, `display: none`). A new
 * rename starts it with the label, focused and selected. Enter commits (`item.rename`; a refused
 * label keeps it open, `aria-invalid`, and emits `(renameError)`), Escape cancels, and leaving it
 * commits (or cancels when refused). Focus goes back to the item. Give it an accessible name.
 */
@Directive({
    selector: "input[treeRenameInput]",
    exportAs: "treeRenameInput",
    host: {
        type: "text",
        "[attr.aria-invalid]": "state().invalid ? 'true' : null",
        "data-tree-part": "rename-input",
        ...ITEM_DATA_HOST,
        "[attr.data-invalid]": "state().invalid ? '' : null",
        "(keydown)": "onKeyDown($event)",
        "(blur)": "onBlur()",
        "(input)": "onInput()",
    },
})
export class TreeRenameInputDirective {
    /** a commit was refused (Enter on an empty label, a middleware's veto) */
    readonly renameError = output<CommandError>();

    private readonly context = injectTreeContext("[treeRenameInput]");
    private readonly item = injectItemContext("[treeRenameInput]");
    private readonly input = injectHost() as HTMLInputElement;
    private readonly injector = inject(Injector);
    private readonly error = signal<CommandError | undefined>(undefined);
    /** this rename is over (committed or cancelled): a later blur does nothing */
    private done = true;

    /** the enclosing item's state, and the last refused commit */
    readonly state: Signal<RenameInputState> = computed(() => {
        const error = this.error();
        return {
            ...this.item.state(),
            invalid: error !== undefined,
            error,
        };
    });

    protected readonly itemData = computed(() => itemData(this.item.state()));

    private readonly renaming = computed(() => this.item.state().renaming);

    constructor() {
        bindStructuralStyle(this.input, () =>
            this.renaming() ? {} : { display: "none" },
        );
        // a new rename: it starts with the label, focused and selected once it is shown
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
        // done before the command: the item taking focus back blurs the input, and that blur must
        // not commit a second time
        this.done = true;
        const result = engine.adapter.commitRename(
            this.item.item().id,
            this.input.value,
            { focus },
        );
        if (result.ok) return true;
        this.done = false;
        this.error.set(result.error);
        this.renameError.emit(result.error);
        return false;
    }

    private cancel(focus: boolean): void {
        if (this.done) return;
        this.done = true;
        this.context
            .engine()
            ?.adapter.cancelRename(this.item.item().id, { focus });
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
