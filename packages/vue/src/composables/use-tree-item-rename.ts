import type { AnyTypes, CommandError, ItemOf, TreeTypes } from "@fragiola/tree";
import {
    type ComputedRef,
    computed,
    type MaybeRefOrGetter,
    nextTick,
    shallowRef,
    toValue,
} from "vue";
import { useTreeContext } from "../context";
import { type ElementRef, elementRef } from "../utils/render";

/** What `useTreeItemRename` says about an item's rename. */
export interface TreeItemRenameState {
    /** the item's label is being edited (`item.start-rename`, F2): render your editor */
    renaming: boolean;
    /** the last commit was refused (an empty label, a middleware's veto) */
    invalid: boolean;
    /** why the last commit was refused */
    error: CommandError | undefined;
}

export interface UseTreeItemRenameOptions {
    /** called when a commit is refused (Enter on an empty label, a middleware's veto) */
    onRenameError?: ((error: CommandError) => void) | undefined;
}

/** The props `useTreeItemRename` gives your editor (`v-bind="props"`). */
export interface TreeItemRenameProps {
    /** the function template ref: it starts the editor with the label, focused and selected */
    ref: ElementRef;
    "aria-invalid": true | undefined;
    "data-invalid": "" | undefined;
    onKeydown: (event: KeyboardEvent) => void;
    onBlur: (event: FocusEvent) => void;
    onInput: (event: Event) => void;
}

/** What `useTreeItemRename` returns: the rename's state, and the props of your editor. */
export interface UseTreeItemRenameResult {
    state: ComputedRef<TreeItemRenameState>;
    /**
     * bind onto your own `<input>` while `state.renaming` (`v-bind="props"`): it starts with the
     * label, focused and selected; Enter commits, Escape cancels, leaving it commits (or cancels
     * when refused); `aria-invalid` and `data-invalid` while a commit is refused
     */
    props: ComputedRef<TreeItemRenameProps>;
}

/**
 * An item's rename, wired onto an editor of yours: no element of its own. Render your input only
 * while `state.renaming`, bind `props` on it and give it an accessible name. Committing and
 * cancelling go through `engine.run("commit-rename" | "cancel-rename")`, which you can call
 * yourself instead; focus goes back to the item. Call it in `setup`, with the item (a value, a ref
 * or a getter).
 *
 * ```ts
 * const { state, props } = useTreeItemRename(() => props.item);
 * // <input v-if="state.renaming" v-bind="props" aria-label="Name" />
 * ```
 */
export function useTreeItemRename<T extends TreeTypes = AnyTypes>(
    item: MaybeRefOrGetter<ItemOf<T>>,
    options: UseTreeItemRenameOptions = {},
): UseTreeItemRenameResult {
    const context = useTreeContext("useTreeItemRename");
    const current = () => toValue(item) as unknown as ItemOf<AnyTypes>;
    let input: HTMLInputElement | null = null;
    // set once this rename is committed or cancelled: the item taking focus back blurs the input,
    // and that blur must not commit a second time
    let done = false;
    const error = shallowRef<CommandError | undefined>();

    // a new rename (a new element): it starts with the label, focused and selected
    const ref = elementRef((element) => {
        const target = element as HTMLInputElement;
        input = target;
        done = false;
        error.value = undefined;
        target.value = current().label;
        const focus = () => {
            if (input !== target) return;
            target.focus({ preventScroll: true });
            target.select();
        };
        // an input mounted with its item (a new item renamed at once) is not in the document yet:
        // it takes focus once the flush has inserted it
        if (target.isConnected) focus();
        else void nextTick(focus);
        return () => {
            if (input === target) input = null;
        };
    });

    // `focus: false` on a blur: focus went elsewhere, and stays there
    const commit = (focus: boolean): boolean => {
        const engine = context.engine.value;
        if (done || !engine) return true;
        done = true;
        const result = engine.run("commit-rename", {
            itemId: current().id,
            label: input?.value ?? "",
            focus,
        });
        if (result.ok) return true;
        done = false;
        error.value = result.error;
        options.onRenameError?.(result.error);
        return false;
    };
    const cancel = (focus: boolean) => {
        const engine = context.engine.value;
        if (done || !engine) return;
        done = true;
        engine.run("cancel-rename", { itemId: current().id, focus });
    };
    const onKeydown = (event: KeyboardEvent) => {
        if (event.key === "Enter") {
            event.preventDefault();
            commit(true);
        } else if (event.key === "Escape") {
            event.preventDefault();
            cancel(true);
        }
    };
    const onBlur = () => {
        if (!done && !commit(false)) cancel(false);
    };
    const onInput = () => {
        if (error.value) error.value = undefined;
    };

    const state = computed<TreeItemRenameState>(() => ({
        renaming: context.state.value.renamingItemId === current().id,
        invalid: error.value !== undefined,
        error: error.value,
    }));
    const props = computed<TreeItemRenameProps>(() => {
        const invalid = error.value !== undefined;
        return {
            ref,
            "aria-invalid": invalid || undefined,
            "data-invalid": invalid ? "" : undefined,
            onKeydown,
            onBlur,
            onInput,
        };
    });
    return { state, props };
}
