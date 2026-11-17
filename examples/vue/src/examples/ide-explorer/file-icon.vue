<script setup lang="ts">
import { type ItemOf, type TreeModel, useTreeState } from "@fragiola/tree-vue";
import {
    Braces,
    type File,
    FileCode,
    FileCog,
    FileImage,
    FileKey,
    FileLock,
    FileText,
    FileType,
    Folder,
    FolderCheck,
    FolderCode,
    FolderGit2,
    FolderOpen,
    Package,
} from "@lucide/vue";
import { computed } from "vue";
import {
    type FileKind,
    type FolderKind,
    fileKindOf,
    folderKindOf,
    type ProjectTypes,
} from "./project";
import * as styles from "./styles";

const props = defineProps<{
    item: ItemOf<ProjectTypes>;
    /** the model, outside the tree (an editor's tab); inside it, the root's */
    model?: TreeModel<ProjectTypes> | undefined;
}>();

const FILE_ICONS: Record<FileKind, typeof File> = {
    code: FileCode,
    data: Braces,
    style: FileType,
    image: FileImage,
    config: FileCog,
    secret: FileKey,
    lock: FileLock,
    text: FileText,
};

const FOLDER_ICONS: Record<FolderKind, typeof File> = {
    plain: Folder,
    source: FolderCode,
    tests: FolderCheck,
    git: FolderGit2,
    managed: Package,
};

const expanded = useTreeState<ProjectTypes, boolean>(
    (_state, current) => current.is("item-expanded", { itemId: props.item.id }),
    { model: props.model },
);

/** A file's icon follows what it holds; a plain folder opens with its item, a special one keeps its own. */
const icon = computed(() => {
    if (props.item.kind === "folder") {
        const kind = folderKindOf(props.item.label);
        return {
            component:
                kind === "plain" && expanded.value
                    ? FolderOpen
                    : FOLDER_ICONS[kind],
            class: styles.folderIcon[kind],
        };
    }
    const kind = fileKindOf(props.item.label);
    return { component: FILE_ICONS[kind], class: styles.fileIcon[kind] };
});
</script>

<template>
    <component :is="icon.component" aria-hidden="true" :class="icon.class" />
</template>
