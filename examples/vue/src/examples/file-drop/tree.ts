import { typedTree } from "@fragiola/tree-vue";
import { dragAndDrop } from "@fragiola/tree-vue/drag-and-drop";
import { dropOutside } from "@fragiola/tree-vue/drop-outside";
import { foreignDrop } from "@fragiola/tree-vue/foreign-drop";
import type { FileTypes } from "../_kit/data";
import * as styles from "./styles";

// Files from the desktop (or another window) dropped on the tree: the target shows as for a
// tree drag, and `onDrop` adds one item per file, from its name and size. The package reads no
// file and uploads nothing: what a drop does is the app's commands. Only the types are known
// before the drop, so `accept` takes a drag that carries files.
const files = foreignDrop<FileTypes>({
    accept: ({ types }) => types.includes("Files"),
    onDrop: ({ dataTransfer, to: { parentItemId, index }, model }) => {
        [...dataTransfer.files].forEach((file, i) => {
            model.run("item.add", {
                item: {
                    kind: "file",
                    label: file.name,
                    data: { size: file.size },
                },
                to: { parentItemId, index: index + i },
            });
        });
    },
});

// Rows dragged out of the tree: a release outside it goes to `onDrop`, with the element under the
// pointer. Over the trash it deletes them (`item.remove`); anywhere else it refuses, and the
// drag is cancelled.
const trash = dropOutside<FileTypes>({
    onDrop: ({ itemIds, element, model }) =>
        element?.closest("[data-trash]") != null &&
        model.run("item.remove", { itemIds: [...itemIds] }).ok,
});

/** The opt-in features of the model: the drags, the files dropped on it, the rows dropped outside. */
export const features = [
    dragAndDrop({ indicatorInset: styles.indicatorInset }),
    files,
    trash,
] as const;

// The primitives typed by FileTypes and the features (a template cannot pass a type argument).
export const Tree = typedTree<FileTypes, typeof features>();
