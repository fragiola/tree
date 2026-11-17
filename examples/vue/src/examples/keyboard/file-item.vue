<script setup lang="ts">
import { type ItemOf, useTreeItemRename } from "@fragiola/tree-vue";
import { ChevronRight, File, Folder } from "@lucide/vue";
import type { FileTypes } from "../_kit/data";
import * as styles from "./styles";
import { Tree } from "./tree";

const props = defineProps<{ item: ItemOf<FileTypes> }>();
// the rename wired onto the app's own input while the item is renaming (F2)
const { state: rename, props: renameProps } = useTreeItemRename(
    () => props.item,
);
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
            <input
                v-if="rename.renaming"
                v-bind="renameProps"
                :aria-label="`Rename ${item.label}`"
                :class="styles.input"
            />
        </Tree.ItemContent>
        <Tree.Group v-slot="{ item: child }">
            <FileItem :item="child" />
        </Tree.Group>
    </Tree.Item>
</template>
