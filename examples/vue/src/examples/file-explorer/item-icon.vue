<script setup lang="ts">
import { type ItemOf, useTreeState } from "@fragiola/tree-vue";
import {
    File,
    FileCode,
    FileImage,
    FileJson,
    FileText,
    Folder,
    FolderOpen,
} from "@lucide/vue";
import { computed } from "vue";
import type { FileTypes } from "../_kit/data";
import * as styles from "./styles";

const props = defineProps<{ item: ItemOf<FileTypes> }>();

/** A folder opens with its item; a file's icon follows its extension. */
const expanded = useTreeState<FileTypes, boolean>((_state, model) =>
    model.is("item-expanded", { itemId: props.item.id }),
);

const FILE_ICONS: Record<string, typeof File> = {
    ts: FileCode,
    tsx: FileCode,
    json: FileJson,
    md: FileText,
    txt: FileText,
    svg: FileImage,
};

const icon = computed(() => {
    if (props.item.kind === "folder") {
        return expanded.value ? FolderOpen : Folder;
    }
    const extension = props.item.label.split(".").pop() ?? "";
    return FILE_ICONS[extension] ?? File;
});
</script>

<template>
    <component
        :is="icon"
        aria-hidden="true"
        :class="item.kind === 'folder' ? styles.folderIcon : styles.fileIcon"
    />
</template>
