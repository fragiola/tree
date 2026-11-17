<script setup lang="ts">
import { type CommandError, type ItemOf, useTree } from "@fragiola/tree-vue";
import { ChevronRight, File, Folder, FolderOpen } from "@lucide/vue";
import type { FileTypes } from "../_kit/data";
import * as styles from "./styles";
import { Tree } from "./tree";

const props = defineProps<{ item: ItemOf<FileTypes>; errorId: string }>();
const emit = defineEmits<{ error: [error: CommandError]; edit: [] }>();
const { model } = useTree<FileTypes>();

// F2 is the tree's key; a double click is the app's, through the same command
const startRename = () =>
    model.run("item.start-rename", { itemId: props.item.id });
</script>

<template>
    <Tree.Item :item="item" :class="styles.item">
        <Tree.ItemContent :class="styles.row" @dblclick="startRename">
            <Tree.Toggle :class="styles.toggle">
                <ChevronRight aria-hidden="true" />
            </Tree.Toggle>
            <template v-if="item.kind === 'folder'">
                <Folder aria-hidden="true" :class="styles.folderClosed" />
                <FolderOpen aria-hidden="true" :class="styles.folderOpen" />
            </template>
            <File v-else aria-hidden="true" :class="styles.fileIcon" />
            <span :class="styles.label">{{ item.label }}</span>
            <!-- rendered only while this item is renaming; a refused label keeps it open -->
            <Tree.RenameInput
                :aria-label="`Rename ${item.label}`"
                :aria-describedby="errorId"
                :class="styles.input"
                @rename-error="(refused) => emit('error', refused)"
                @input="emit('edit')"
            />
        </Tree.ItemContent>
        <Tree.Group v-slot="{ item: child }">
            <FileItem
                :item="child"
                :error-id="errorId"
                @error="(refused) => emit('error', refused)"
                @edit="emit('edit')"
            />
        </Tree.Group>
    </Tree.Item>
</template>
