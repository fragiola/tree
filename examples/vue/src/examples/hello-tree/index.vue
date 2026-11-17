<script setup lang="ts">
import type { TreeJson } from "@fragiola/tree-vue";
import ItemNode from "./item-node.vue";
import * as styles from "./styles";
import { Tree, type Types } from "./tree";

// A tree is JSON: the root items, then every item by its id. A parent lists its children.
const json: TreeJson<Types> = {
    version: 1,
    rootItemIds: ["docs", "notes"],
    items: {
        docs: {
            kind: "folder",
            label: "Documents",
            childItemIds: ["plan", "budget"],
        },
        plan: { kind: "file", label: "Plan.md" },
        budget: { kind: "file", label: "Budget.csv" },
        notes: { kind: "folder", label: "Notes", childItemIds: ["ideas"] },
        ideas: { kind: "file", label: "Ideas.md" },
    },
    expandedItemIds: ["docs"],
};
</script>

<template>
    <div :class="styles.frame">
        <!-- the root keeps its own model from `default-tree`; the name is yours -->
        <Tree.Root :default-tree="json" aria-label="Documents" :class="styles.root">
            <Tree.Items v-slot="{ item }">
                <ItemNode :item="item" />
            </Tree.Items>
        </Tree.Root>
    </div>
</template>
