<script setup lang="ts">
import {
    type CommandError,
    type ItemOf,
    useTree,
    useTreeItemRename,
} from "@fragiola/tree-vue";
import { ChevronRight, File, Folder, FolderOpen } from "@lucide/vue";
import type { FileTypes } from "../_kit/data";
import * as styles from "./styles";
import { Tree } from "./tree";

const props = defineProps<{ item: ItemOf<FileTypes>; errorId: string }>();
const emit = defineEmits<{ error: [error: CommandError]; edit: [] }>();
const { model } = useTree<FileTypes>();
// the rename wired onto the app's own input: it starts with the label, focused and selected;
// Enter commits, Escape cancels, and a refused label keeps it open (`aria-invalid`)
const { state: rename, props: renameProps } = useTreeItemRename(
    () => props.item,
    { onRenameError: (refused) => emit("error", refused) },
);

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
            <!-- rendered only while this item is renaming -->
            <input
                v-if="rename.renaming"
                v-bind="renameProps"
                :aria-label="`Rename ${item.label}`"
                :aria-describedby="errorId"
                :class="styles.input"
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
