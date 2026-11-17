<script setup lang="ts">
import type { ItemOf } from "@fragiola/tree-vue";
import {
    ChevronRight,
    File,
    Folder,
    FolderLock,
    GripVertical,
    Lock,
} from "@lucide/vue";
import * as styles from "./styles";
import { Tree, type Types } from "./tree";

defineProps<{ item: ItemOf<Types>; lockedId: string }>();
</script>

<template>
    <Tree.Item
        :item="item"
        :aria-describedby="
            item.movable === false || item.droppable === false
                ? lockedId
                : undefined
        "
        :class="styles.item"
    >
        <Tree.ItemContent :class="styles.row">
            <GripVertical aria-hidden="true" :class="styles.grip" />
            <Tree.Toggle :class="styles.toggle">
                <ChevronRight aria-hidden="true" />
            </Tree.Toggle>
            <template v-if="item.kind === 'folder'">
                <FolderLock
                    v-if="item.droppable === false"
                    aria-hidden="true"
                    :class="styles.folderIcon"
                />
                <Folder v-else aria-hidden="true" :class="styles.folderIcon" />
            </template>
            <File v-else aria-hidden="true" :class="styles.fileIcon" />
            <span :class="styles.label">{{ item.label }}</span>
            <Lock
                v-if="item.movable === false"
                aria-hidden="true"
                :class="styles.lock"
            />
        </Tree.ItemContent>
        <Tree.Group v-slot="{ item: child }">
            <FileItem :item="child" :locked-id="lockedId" />
        </Tree.Group>
    </Tree.Item>
</template>
