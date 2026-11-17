import type { CommandError } from "@fragiola/tree";
import { shallowRef } from "vue";
import { itemDataAttributes } from "../composables/internal";
import type { TreeItemState } from "../composables/use-tree-item";
import { useItemContext, useTreeContext } from "../context";
import {
    definePrimitive,
    type PrimitiveProps,
    type TreeComponent,
} from "../utils/primitive";
import { elementRef, type RenderSlot, renderElement } from "../utils/render";

export interface RenameInputState extends TreeItemState {
    /** the last commit was refused (an empty label, a middleware's veto) */
    invalid: boolean;
    /** why the last commit was refused */
    error: CommandError | undefined;
}

export interface RenameInputProps extends PrimitiveProps {}

export interface RenameInputSlots extends RenderSlot<RenameInputState> {}

/** The events of `Tree.RenameInput`. */
export type RenameInputEmits = {
    /** a commit was refused (Enter on an empty label, a middleware's veto): `@rename-error` */
    renameError: (error: CommandError) => void;
};

/**
 * The enclosing item's label editor, rendered only while the item is renaming
 * (`item.start-rename`, F2): it starts with the label, focused and selected. Enter commits
 * (`item.rename`; a refused label keeps it open, `aria-invalid`), Escape cancels, and leaving it
 * commits (or cancels when refused). Focus goes back to the item. Give it an accessible name.
 */
export const RenameInput: TreeComponent<
    RenameInputProps,
    RenameInputSlots,
    RenameInputEmits
> = definePrimitive<RenameInputProps, RenameInputSlots, RenameInputEmits>(
    "RenameInput",
    ["as"],
    (props, { attrs, slots, emit }) => {
        const { engine, state: tree } = useTreeContext("RenameInput");
        const itemContext = useItemContext("RenameInput");
        const itemId = () => itemContext.value.item.id;
        let input: HTMLInputElement | null = null;
        let done = false;
        const error = shallowRef<CommandError | undefined>();

        // a new rename (a new element): it starts with the label, focused and selected
        const ref = elementRef((element) => {
            input = element as HTMLInputElement;
            done = false;
            error.value = undefined;
            input.value = itemContext.value.item.label;
            input.focus({ preventScroll: true });
            input.select();
            return () => {
                input = null;
            };
        });

        // `focus: false` on a blur: focus went elsewhere, and stays there
        const commit = (focus: boolean): boolean => {
            const current = engine.value;
            if (done || !current) return true;
            // done before the command: the item taking focus back blurs the input, and that blur
            // must not commit a second time
            done = true;
            const result = current.adapter.commitRename(
                itemId(),
                input?.value ?? "",
                { focus },
            );
            if (result.ok) return true;
            done = false;
            error.value = result.error;
            emit("renameError", result.error);
            return false;
        };
        const cancel = (focus: boolean) => {
            if (done) return;
            done = true;
            engine.value?.adapter.cancelRename(itemId(), { focus });
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

        return () => {
            if (tree.value.renamingItemId !== itemId()) return null;
            const itemState = itemContext.value.state;
            const state: RenameInputState = {
                ...itemState,
                invalid: error.value !== undefined,
                error: error.value,
            };
            return renderElement({
                tag: "input",
                as: props.as,
                attrs,
                render: slots.render,
                state,
                ref,
                props: {
                    type: "text",
                    "aria-invalid": state.invalid || undefined,
                    "data-tree-part": "rename-input",
                    ...itemDataAttributes(itemState),
                    ...(state.invalid ? { "data-invalid": "" } : {}),
                    onKeydown,
                    onBlur,
                    onInput,
                },
            });
        };
    },
    { emits: ["renameError"] },
);
