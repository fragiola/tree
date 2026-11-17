import type { CommandError } from "@fragiola/tree";
import * as React from "react";
import { useItemContext, useTreeContext } from "../context";
import {
    itemDataAttributes,
    useIsomorphicLayoutEffect,
    useTreeItemState,
} from "../hooks/internal";
import type { TreeItemState } from "../hooks/use-tree-item";
import {
    type InputPrimitiveProps,
    useRenderElement,
} from "../utils/use-render";

export interface RenameInputState extends TreeItemState {
    /** the last commit was refused (an empty label, a middleware's veto) */
    invalid: boolean;
    /** why the last commit was refused */
    error: CommandError | undefined;
}

export interface RenameInputProps
    extends InputPrimitiveProps<RenameInputState> {
    /** called when a commit is refused (Enter on an empty label, a middleware's veto) */
    onRenameError?: ((error: CommandError) => void) | undefined;
}

/**
 * The enclosing item's label editor, rendered only while the item is renaming
 * (`item.start-rename`, F2): it starts with the label, focused and selected. Enter commits
 * (`item.rename`; a refused label keeps it open, `aria-invalid`), Escape cancels, and leaving it
 * commits (or cancels when refused). Focus goes back to the item. Give it an accessible name.
 */
export function RenameInput(props: RenameInputProps) {
    const { item } = useItemContext("RenameInput");
    const { state: treeState } = useTreeContext("RenameInput");
    if (treeState.renamingItemId !== item.id) return null;
    return <RenameInputElement {...props} />;
}

function RenameInputElement(props: RenameInputProps) {
    const { onRenameError, ...rest } = props;
    const { engine } = useTreeContext("RenameInput");
    const { item } = useItemContext("RenameInput");
    const itemState = useTreeItemState(item);
    const itemId = item.id;
    const input = React.useRef<HTMLInputElement | null>(null);
    const done = React.useRef(false);
    const [error, setError] = React.useState<CommandError | undefined>();
    const latest = React.useRef(onRenameError);
    latest.current = onRenameError;

    useIsomorphicLayoutEffect(() => {
        input.current?.focus({ preventScroll: true });
        input.current?.select();
    }, []);

    const commit = (): boolean => {
        if (done.current || !engine) return true;
        const result = engine.adapter.commitRename(
            itemId,
            input.current?.value ?? "",
        );
        if (result.ok) {
            done.current = true;
            return true;
        }
        setError(result.error);
        latest.current?.(result.error);
        return false;
    };
    const cancel = () => {
        if (done.current) return;
        done.current = true;
        engine?.adapter.cancelRename(itemId);
    };
    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            commit();
        } else if (event.key === "Escape") {
            event.preventDefault();
            cancel();
        }
    };
    const onBlur = () => {
        if (!done.current && !commit()) cancel();
    };
    const onChange = () => {
        if (error) setError(undefined);
    };
    const ref = React.useCallback((element: HTMLElement | null) => {
        input.current = element as HTMLInputElement | null;
    }, []);

    const state: RenameInputState = {
        ...itemState,
        invalid: error !== undefined,
        error,
    };
    return useRenderElement("input", rest, {
        state,
        ref,
        props: {
            type: "text",
            defaultValue: item.label,
            "aria-invalid": state.invalid || undefined,
            "data-tree-part": "rename-input",
            ...itemDataAttributes(itemState),
            ...(state.invalid ? { "data-invalid": "" } : {}),
            onKeyDown,
            onBlur,
            onChange,
        },
    });
}
