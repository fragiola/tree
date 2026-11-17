// The rename's part hook (`@fragiola/tree-react/rename`): it wires the app's own editor onto an
// item's rename (`rename()`). A tree that never imports it does not ship it.
import type {
    AnyFeatures,
    AnyTypes,
    CommandError,
    ItemOf,
    TreeEngine,
    TreeTypes,
} from "@fragiola/tree";
import * as React from "react";
import { useTreeContext } from "../context";
import { useIsomorphicLayoutEffect } from "../hooks/internal";

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

/** The props `useTreeItemRename` gives your editor. */
export type TreeItemRenameProps =
    React.InputHTMLAttributes<HTMLInputElement> & {
        ref: React.RefCallback<HTMLInputElement>;
        "data-invalid"?: string | undefined;
    };

/** What `useTreeItemRename` returns: the rename's state, and the props of your editor. */
export interface UseTreeItemRenameResult {
    state: TreeItemRenameState;
    /**
     * spread onto your own `<input>` while `state.renaming`: it starts with the label, focused and
     * selected; Enter commits, Escape cancels, leaving it commits (or cancels when refused);
     * `aria-invalid` and `data-invalid` while a commit is refused
     */
    props: TreeItemRenameProps;
}

/**
 * An item's rename, wired onto an editor of yours: no element of its own. Render your input only
 * while `state.renaming`, spread `props` on it and give it an accessible name. Committing and
 * cancelling go through `engine.run("commit-rename" | "cancel-rename")`, which you can call
 * yourself instead; focus goes back to the item.
 *
 * ```tsx
 * const { state, props } = useTreeItemRename(item);
 * return state.renaming ? <input {...props} aria-label="Name" /> : <span>{item.label}</span>;
 * ```
 */
export function useTreeItemRename<T extends TreeTypes = AnyTypes>(
    item: ItemOf<T>,
    options: UseTreeItemRenameOptions = {},
): UseTreeItemRenameResult {
    const context = useTreeContext("useTreeItemRename");
    const engine = context.engine as TreeEngine<AnyTypes, AnyFeatures> | null;
    const itemId = item.id;
    // the rename's state (`rename()`): a model without it never renames
    const renaming =
        (context.state as { readonly renamingItemId?: string | null })
            .renamingItemId === itemId;
    const input = React.useRef<HTMLInputElement | null>(null);
    // set once this rename is committed or cancelled: the item taking focus back blurs the input,
    // and that blur must not commit a second time
    const done = React.useRef(false);
    const [error, setError] = React.useState<CommandError | undefined>();
    const latest = React.useRef(options.onRenameError);
    latest.current = options.onRenameError;

    // each rename starts afresh: the editor (mounted with it) focused and its text selected, once
    useIsomorphicLayoutEffect(() => {
        if (!renaming) return;
        done.current = false;
        setError(undefined);
        input.current?.focus({ preventScroll: true });
        input.current?.select();
    }, [renaming]);

    // `focus: false` on a blur: focus went elsewhere, and stays there
    const commit = (focus: boolean): boolean => {
        if (done.current || !engine) return true;
        done.current = true;
        const result = engine.run("commit-rename", {
            itemId,
            label: input.current?.value ?? "",
            focus,
        });
        if (result.ok) return true;
        done.current = false;
        setError(result.error);
        latest.current?.(result.error);
        return false;
    };
    const cancel = (focus: boolean) => {
        if (done.current || !engine) return;
        done.current = true;
        engine.run("cancel-rename", { itemId, focus });
    };
    const ref = React.useCallback((element: HTMLInputElement | null) => {
        input.current = element;
    }, []);

    const invalid = error !== undefined;
    const props: TreeItemRenameProps = {
        ref,
        defaultValue: item.label,
        "aria-invalid": invalid || undefined,
        ...(invalid ? { "data-invalid": "" } : {}),
        onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === "Enter") {
                event.preventDefault();
                commit(true);
            } else if (event.key === "Escape") {
                event.preventDefault();
                cancel(true);
            }
        },
        onBlur: () => {
            if (done.current || commit(false)) return;
            // leaving with a refused label cancels: the rename is over, and so is its error
            cancel(false);
            setError(undefined);
        },
        onChange: () => {
            if (error) setError(undefined);
        },
    };
    return { state: { renaming, invalid, error }, props };
}
