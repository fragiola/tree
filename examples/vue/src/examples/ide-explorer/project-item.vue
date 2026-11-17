<script setup lang="ts">
import {
    type CommandError,
    type ItemOf,
    useTree,
    useTreeState,
} from "@fragiola/tree-vue";
import { useTreeItemRename } from "@fragiola/tree-vue/rename";
import { ChevronRight, LoaderCircle } from "@lucide/vue";
import { computed, useId } from "vue";
import FileIcon from "./file-icon.vue";
import {
    gitSummary,
    isManaged,
    type ProjectTypes,
    STATUS_LETTERS,
} from "./project";
import * as styles from "./styles";
import { Tree } from "./tree";
import type { features } from "./workspace";

const props = defineProps<{ item: ItemOf<ProjectTypes> }>();
const emit = defineEmits<{ renameError: [error: CommandError | undefined] }>();
const { model } = useTree<ProjectTypes, typeof features>();
// the app's own input edits the label: Enter commits, Escape cancels, a refused name stays open
const { state: rename, props: renameProps } = useTreeItemRename(
    () => props.item,
    { onRenameError: (error) => emit("renameError", error) },
);
const loading = useTreeState<ProjectTypes, boolean, typeof features>(
    (_state, current) => current.is("item-loading", { itemId: props.item.id }),
);
// a folder holding a change gets a dot: derived from the files' status, once per state
const changed = useTreeState<ProjectTypes, boolean>((_state, current) =>
    gitSummary(current).changedFolderIds.has(props.item.id),
);
const status = computed(() =>
    props.item.kind === "file" ? props.item.data.status : undefined,
);
const statusId = useId();
const managed = computed(() => isManaged(model, props.item.id));

// F2 is the tree's key; a double click is the app's, through the same command
const startRename = () =>
    model.run("item.start-rename", { itemId: props.item.id });
</script>

<template>
    <Tree.Item
        :item="item"
        :aria-describedby="status ? statusId : undefined"
        :class="styles.item"
    >
        <Tree.ItemContent :class="styles.row" @dblclick="startRename">
            <Tree.Toggle :class="styles.toggle">
                <ChevronRight aria-hidden="true" />
            </Tree.Toggle>
            <FileIcon :item="item" />
            <span :class="styles.label({ status, managed })">{{ item.label }}</span>
            <input
                v-if="rename.renaming"
                v-bind="renameProps"
                :aria-label="`Rename ${item.label}`"
                :class="styles.input"
                @input="emit('renameError', undefined)"
            />
            <LoaderCircle v-if="loading" aria-hidden="true" :class="styles.spinner" />
            <!-- the letter is for the eyes; the item is described by the status's word -->
            <span v-if="status" :title="status" aria-hidden="true" :class="styles.status(status)">
                {{ STATUS_LETTERS[status] }}
                <span :id="statusId" hidden>{{ status }}</span>
            </span>
            <span
                v-if="item.kind === 'folder' && changed"
                aria-hidden="true"
                data-testid="changed-folder"
                :class="styles.changedDot"
            />
        </Tree.ItemContent>
        <Tree.Group v-slot="{ item: child }">
            <ProjectItem :item="child" @rename-error="(error) => emit('renameError', error)" />
        </Tree.Group>
    </Tree.Item>
</template>
