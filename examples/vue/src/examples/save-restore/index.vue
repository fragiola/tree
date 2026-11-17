<script setup lang="ts">
import {
    createTreeModel,
    type TreeModel,
    useTreeState,
    validateTree,
} from "@fragiola/tree-vue";
import { DropIndicator } from "@fragiola/tree-vue/drag-and-drop";
import { RotateCcw, Trash2 } from "@lucide/vue";
import { onMounted, onUnmounted, ref } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { type FileTypes, fileSystem } from "../_kit/data";
import { persistTree, restoreTree } from "../_kit/persist";
import FileItem from "./file-item.vue";
import * as styles from "./styles";
import { features, Tree } from "./tree";

/** Where the document is saved: one key per tree. */
const STORAGE_KEY = "fragiola-tree:examples:save-restore";

/** A model of the saved document when there is a valid one, else of the default. */
function restore(): {
    model: TreeModel<FileTypes, typeof features>;
    restored: boolean;
} {
    const saved = restoreTree<FileTypes>(STORAGE_KEY);
    // a document saved by an older version of the app may no longer be valid
    const restored =
        saved !== undefined && validateTree(saved, { features }).length === 0;
    const json = restored ? saved : fileSystem();
    return {
        model: createTreeModel<FileTypes, typeof features>(json, { features }),
        restored,
    };
}

// the model is created once, outside Vue's reactivity
const { model, restored } = restore();
const savedAt = ref<Date>();

// every committed change of the tree (an expansion, a rename, a move, a removal) is saved
let stop: (() => void) | undefined;
onMounted(() => {
    stop = persistTree(model, STORAGE_KEY, () => {
        savedAt.value = new Date();
    });
});
onUnmounted(() => stop?.());

const selected = useTreeState<FileTypes, number, typeof features>(
    (state) => state.selectedItemIds.length,
    { model },
);

const remove = () =>
    model.run("item.remove", { itemIds: [...model.state.selectedItemIds] });
// `tree.load` replaces the whole document: the listener saves it too
const reset = () => model.run("tree.load", { json: fileSystem() });
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <p
                role="status"
                data-testid="save-status"
                :class="styles.status(savedAt !== undefined)"
            >
                {{
                    savedAt
                        ? `Saved at ${savedAt.toLocaleTimeString()}`
                        : restored
                          ? "Restored from this browser"
                          : "Change the tree, then reload the page"
                }}
            </p>
            <Clickable.Button
                variant="outline"
                size="sm"
                :disabled="selected === 0"
                @click="remove"
            >
                <Trash2 aria-hidden="true" />
                Delete
            </Clickable.Button>
            <Clickable.Button variant="outline" size="sm" @click="reset">
                <RotateCcw aria-hidden="true" />
                Reset
            </Clickable.Button>
        </div>
        <Tree.Root
            :model="model"
            aria-label="Project files"
            :class="styles.root"
        >
            <Tree.Items v-slot="{ item }">
                <FileItem :item="item" />
            </Tree.Items>
            <DropIndicator :class="styles.dropIndicator" />
        </Tree.Root>
        <p :class="styles.hint">
            Expand, drag, rename (F2) or delete, then reload: the tree comes
            back as you left it.
        </p>
    </div>
</template>
