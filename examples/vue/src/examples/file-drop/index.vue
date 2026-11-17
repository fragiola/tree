<script setup lang="ts">
import {
    type AnnounceEvent,
    createTreeDropOutside,
    createTreeForeignDrop,
    createTreeModel,
    type DropTarget,
    type TreeModel,
    useTreeRef,
} from "@fragiola/tree-vue";
import { Trash2, Upload } from "@lucide/vue";
import { ref, watchEffect } from "vue";
import { type FileTypes, fileSystem } from "../_kit/data";
import FileItem from "./file-item.vue";
import * as styles from "./styles";
import { Tree } from "./tree";

// Files from the desktop (or another window) dropped on the tree: the target shows as for a
// tree drag, and `onDrop` adds one item per file, from its name and size. The package reads no
// file and uploads nothing: what a drop does is the app's commands. Only the types are known
// before the drop, so `accept` takes a drag that carries files.
const foreignDrop = createTreeForeignDrop<FileTypes>({
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
const dropOutside = createTreeDropOutside<FileTypes>({
    onDrop: ({ itemIds, element, model }) =>
        element?.closest("[data-trash]") != null &&
        model.run("item.remove", { itemIds: [...itemIds] }).ok,
});

/** The live region's text for each step: the package writes none. */
function announcer(model: TreeModel<FileTypes>) {
    const label = (itemId: string | null) =>
        itemId === null
            ? "the project"
            : (model.get("item-by", { id: itemId })?.label ?? itemId);
    const where = (target: DropTarget) =>
        target.position === "inside"
            ? `into ${label(target.itemId)}`
            : `${target.position} ${label(target.itemId)}`;
    return (event: AnnounceEvent): string | undefined => {
        switch (event.type) {
            case "foreign-drag-over":
                return event.target
                    ? `Drop the files ${where(event.target)}.`
                    : "No place for files here.";
            case "foreign-drop":
                return `Added the files ${where(event.target)}.`;
            case "drag-start":
                return `Picked up ${event.itemIds.map(label).join(", ")}.`;
            case "drop":
                return `Moved ${where(event.target)}.`;
            case "drop-outside":
                return `Deleted ${event.itemIds.length} item${event.itemIds.length === 1 ? "" : "s"}.`;
            case "drag-cancel":
                return "Cancelled.";
            default:
                return undefined;
        }
    };
}

// The model is the source of truth: create it once (never in a ref).
const model = createTreeModel<FileTypes>(fileSystem());
const announce = announcer(model);
const tree = useTreeRef<FileTypes>();

// Whether the tree's drag is over the trash: `drop-outside-element` is the element under the
// pointer while a drag is outside the tree (the pointer stays captured by the row, so the trash
// gets no pointer events of its own).
const overTrash = ref(false);
watchEffect((onCleanup) => {
    const engine = tree.value?.engine;
    if (!engine) return;
    onCleanup(
        engine.subscribe(() => {
            overTrash.value =
                engine.get("drop-outside-element")?.closest("[data-trash]") !=
                null;
        }),
    );
});
</script>

<template>
    <div :class="styles.frame">
        <Tree.Root
            :model="model"
            :tree-ref="tree"
            :foreign-drop="foreignDrop"
            :drop-outside="dropOutside"
            :announce="announce"
            :indicator-inset="styles.indicatorInset"
            aria-label="Project files"
            :class="styles.root"
        >
            <Tree.Items v-slot="{ item }">
                <FileItem :item="item" />
            </Tree.Items>
            <Tree.DropIndicator :class="styles.dropIndicator" />
            <Tree.LiveRegion :class="styles.liveRegion" />
        </Tree.Root>
        <!-- the app's own target: data-trash is what onDrop looks for -->
        <div
            data-trash=""
            :data-over="overTrash ? '' : undefined"
            data-testid="trash"
            :class="styles.trash"
        >
            <Trash2 aria-hidden="true" :class="styles.trashIcon" />
            Drag rows here to delete them
        </div>
        <p :class="styles.hint">
            <Upload aria-hidden="true" :class="styles.hintIcon" /> Drop files
            from your computer into a folder: they are listed, not uploaded.
        </p>
    </div>
</template>
