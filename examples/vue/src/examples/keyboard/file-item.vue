<script setup lang="ts">
import type { ItemOf } from "@fragiola/tree-vue";
import { ChevronRight, File, Folder } from "@lucide/vue";
import type { FileTypes } from "../_kit/data";
import * as styles from "./styles";
import { Tree } from "./tree";

defineProps<{ item: ItemOf<FileTypes> }>();
</script>

<template>
    <Tree.Item :item="item" :class="styles.item">
        <Tree.ItemContent :class="styles.row">
            <Tree.Toggle :class="styles.toggle">
                <ChevronRight aria-hidden="true" />
            </Tree.Toggle>
            <Folder
                v-if="item.kind === 'folder'"
                aria-hidden="true"
                :class="styles.folderIcon"
            />
            <File v-else aria-hidden="true" :class="styles.fileIcon" />
            <span :class="styles.label">{{ item.label }}</span>
            <Tree.RenameInput
                :aria-label="`Rename ${item.label}`"
                :class="styles.input"
            />
        </Tree.ItemContent>
        <Tree.Group v-slot="{ item: child }">
            <FileItem :item="child" />
        </Tree.Group>
    </Tree.Item>
</template>
