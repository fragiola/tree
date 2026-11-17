<script setup lang="ts">
import {
    type AnnounceEvent,
    createTreeModel,
    type DropTarget,
    type TreeModel,
} from "@fragiola/tree-vue";
import { useId } from "vue";
import { type FileTypes, fileSystem } from "../_kit/data";
import FileItem from "./file-item.vue";
import * as styles from "./styles";
import { features, Tree } from "./tree";

// Every key is the engine's (the WAI-ARIA APG tree view, `DEFAULT_KEY_MAP`): the example only
// lists them. `key-map` on the root would change any of them.
// `join`: "+" for a chord, "/" for two keys doing the two halves of one line.
const KEYS: readonly {
    keys: readonly string[];
    join?: "+" | "/";
    does: string;
}[] = [
    { keys: ["↓", "↑"], join: "/", does: "Next, previous item" },
    { keys: ["→"], does: "Expand, or go to the first child" },
    { keys: ["←"], does: "Collapse, or go to the parent" },
    { keys: ["Home", "End"], join: "/", does: "First, last item" },
    { keys: ["a–z"], does: "Jump to a label (type-ahead)" },
    { keys: ["*"], does: "Expand the siblings" },
    { keys: ["Enter"], does: "Select" },
    { keys: ["Space"], does: "Toggle the selection" },
    { keys: ["Shift", "↓"], does: "Extend the selection" },
    { keys: ["Ctrl", "A"], does: "Select all" },
    { keys: ["F2"], does: "Rename" },
    {
        keys: ["Ctrl", "Shift", "D"],
        does: "Drag: then ↑ ↓, Enter drops, Esc cancels",
    },
];

/** What the live region says at each step of a keyboard (or pointer) drag. */
function announcer(model: TreeModel<FileTypes>) {
    const label = (itemId: string | null) =>
        itemId === null
            ? "the tree"
            : (model.get("item-by", { id: itemId })?.label ?? itemId);
    const names = (itemIds: readonly string[]) => itemIds.map(label).join(", ");
    const where = (target: DropTarget) =>
        target.position === "inside"
            ? `into ${label(target.itemId)}`
            : `${target.position} ${label(target.itemId)}`;
    return (event: AnnounceEvent): string | undefined => {
        switch (event.type) {
            case "drag-start":
                // a keyboard drag's start comes with its first place, said in one message
                return event.target
                    ? `Picked up ${names(event.itemIds)}. Up and Down choose a place, Enter drops, Escape cancels. Drop ${where(event.target)}.`
                    : `Picked up ${names(event.itemIds)}.`;
            case "drag-over":
                return event.target
                    ? `Drop ${where(event.target)}.`
                    : "No place to drop here.";
            case "drop":
                return `Moved ${names(event.itemIds)} ${where(event.target)}.`;
            case "drag-cancel":
                return `Cancelled. ${names(event.itemIds)} stayed in place.`;
            default:
                return undefined;
        }
    };
}

// The model is the source of truth: create it once (never in a ref).
const model = createTreeModel<FileTypes, typeof features>(
    {
        ...fileSystem(),
        settings: { selectionMode: "multiple" },
    },
    { features },
);
const announce = announcer(model);
const legendId = useId();
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.treeColumn">
            <Tree.Root
                :indicator-inset="styles.indicatorInset"
                :model="model"
                :announce="announce"
                aria-label="Project files"
                :class="styles.root"
            >
                <Tree.Items v-slot="{ item }">
                    <FileItem :item="item" />
                </Tree.Items>
                <Tree.DropIndicator :class="styles.dropIndicator" />
                <!-- visible here, to show what a screen reader hears during a drag -->
                <Tree.LiveRegion :class="styles.liveRegion" />
            </Tree.Root>
        </div>
        <section :aria-labelledby="legendId" :class="styles.legend">
            <h2 :id="legendId" :class="styles.legendTitle">Keys</h2>
            <dl :class="styles.keyList">
                <div v-for="{ keys, join = '+', does } in KEYS" :key="does" :class="styles.keyRow">
                    <dt :class="styles.keys">
                        <template v-for="(key, index) in keys" :key="key"><span v-if="index > 0" aria-hidden="true" :class="styles.plus">{{ join }}</span><kbd :class="styles.kbd">{{ key }}</kbd></template>
                    </dt>
                    <dd :class="styles.does">{{ does }}</dd>
                </div>
            </dl>
        </section>
    </div>
</template>
