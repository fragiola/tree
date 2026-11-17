<script setup lang="ts">
import { selection } from "@fragiola/tree-vue/selection";
import { fileSystem } from "../_kit/data";
import FileItem from "./file-item.vue";
import * as styles from "./styles";
import { Tree } from "./tree";

/** The opt-in features of the root's model: the selection. */
const features = [selection()];

// The kit's file system: folders, and files whose `data` is `{ size }` (typed by `FileTypes`).
const json = fileSystem();
</script>

<template>
    <div :class="styles.frame">
        <!-- expand-on-click: a click on a folder's row also opens or closes it -->
        <Tree.Root
            :default-tree="json" :features="features"
            expand-on-click
            aria-label="Project files"
            :class="styles.root"
        >
            <Tree.Items v-slot="{ item }">
                <FileItem :item="item" />
            </Tree.Items>
        </Tree.Root>
    </div>
</template>
