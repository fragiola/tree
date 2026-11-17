<script setup lang="ts">
import {
    createTreeModel,
    type TreeStateOf,
    useTreeState,
} from "@fragiola/tree-vue";
import { type SelectionFeature, selection } from "@fragiola/tree-vue/selection";
import { Redo2, Trash2, Undo2 } from "@lucide/vue";
import { onUnmounted, shallowRef } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { type FileTypes, fileSystem } from "../_kit/data";
import { UndoManager } from "../_kit/undo";
import FileItem from "./file-item.vue";
import * as styles from "./styles";
import { Tree } from "./tree";

/** The state of a model with the selection feature. */
type Selected = TreeStateOf<FileTypes, readonly [SelectionFeature]>;

// Undo/redo is app code (`_kit/undo.ts`): it listens to the model's commits, keeps the document
// before each step, and puts it back with `tree.load`. The package ships no history.

/** What a step is called in the history list. */
const STEP_NAMES: Partial<Record<string, string>> = {
    "item.rename": "Rename",
    "item.remove": "Delete",
    "item.move": "Move",
    "item.expand": "Expand",
    "item.collapse": "Collapse",
    "item.toggle": "Expand or collapse",
};
const stepName = (command: string) => STEP_NAMES[command] ?? command;

// the model and its history are created once, outside Vue's reactivity
const model = createTreeModel<FileTypes, readonly [SelectionFeature]>(
    fileSystem(),
    { features: [selection()] },
);
const history = new UndoManager(model);
// the history's snapshot, as a ref that changes with it
const snapshot = shallowRef(history.getSnapshot());
onUnmounted(
    history.subscribe(() => {
        snapshot.value = history.getSnapshot();
    }),
);

const selected = useTreeState<FileTypes, number>(
    (state) => (state as Selected).selectedItemIds.length,
    { model },
);
const remove = () =>
    model.run("item.remove", { itemIds: [...model.state.selectedItemIds] });

// the app's shortcuts, on the tree: Ctrl/⌘+Z undoes, with Shift (or Ctrl+Y) redoes, Delete
// removes the selection. The tree's own keys run first; these are not among them.
const onKeydown = (event: KeyboardEvent) => {
    // the rename input keeps its own Ctrl+Z (the text's undo) and Delete
    if (event.target instanceof HTMLInputElement) return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (mod && key === "z") history[event.shiftKey ? "redo" : "undo"]();
    else if (mod && key === "y") history.redo();
    else if (event.key === "Delete" && selected.value > 0) remove();
    else return;
    event.preventDefault();
};
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <Clickable.Button
                variant="outline"
                size="sm"
                :disabled="!snapshot.canUndo"
                @click="history.undo()"
            >
                <Undo2 aria-hidden="true" />
                Undo
            </Clickable.Button>
            <Clickable.Button
                variant="outline"
                size="sm"
                :disabled="!snapshot.canRedo"
                @click="history.redo()"
            >
                <Redo2 aria-hidden="true" />
                Redo
            </Clickable.Button>
            <Clickable.Button
                variant="outline"
                size="sm"
                :class="styles.deleteButton"
                :disabled="selected === 0"
                @click="remove"
            >
                <Trash2 aria-hidden="true" />
                Delete
            </Clickable.Button>
        </div>
        <div :class="styles.body">
            <Tree.Root
                :indicator-inset="styles.indicatorInset"
                :model="model"
                aria-label="Project files"
                :class="styles.root"
                @keydown="onKeydown"
            >
                <Tree.Items v-slot="{ item }">
                    <FileItem :item="item" />
                </Tree.Items>
                <Tree.DropIndicator :class="styles.dropIndicator" />
            </Tree.Root>
            <section aria-label="History" :class="styles.history">
                <h2 :class="styles.historyTitle">History</h2>
                <ol data-testid="history" :class="styles.steps">
                    <li
                        v-if="
                            snapshot.undoSteps.length +
                                snapshot.redoSteps.length ===
                            0
                        "
                        :class="styles.empty"
                    >
                        Rename (F2), drag or delete an item.
                    </li>
                    <li
                        v-for="(step, index) in snapshot.undoSteps"
                        :key="`done-${index}`"
                        :class="styles.step"
                    >
                        {{ stepName(step.command) }}
                    </li>
                    <!-- redo goes forward through these: the next one is last -->
                    <li
                        v-for="(step, index) in [...snapshot.redoSteps].reverse()"
                        :key="`undone-${index}`"
                        data-undone=""
                        :class="styles.step"
                    >
                        {{ stepName(step.command) }}
                    </li>
                </ol>
            </section>
        </div>
    </div>
</template>
