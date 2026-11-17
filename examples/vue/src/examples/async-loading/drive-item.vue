<script setup lang="ts">
import { type ItemOf, useTreeState } from "@fragiola/tree-vue";
import { ChevronRight, File, Folder, LoaderCircle } from "@lucide/vue";
import { useId } from "vue";
import { type FileTypes, formatSize } from "../_kit/data";
import RetryButton from "./retry-button.vue";
import * as styles from "./styles";
import { Tree } from "./tree";

const props = defineProps<{ item: ItemOf<FileTypes> }>();

const status = useTreeState<FileTypes, string | undefined>((_state, model) =>
    model.get("children-status-by", { itemId: props.item.id }),
);
// the size describes a file; the label alone is its accessible name
const sizeId = useId();
</script>

<template>
    <Tree.Item
        :item="item"
        :aria-describedby="item.kind === 'file' ? sizeId : undefined"
        :class="styles.item"
    >
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
            <span
                v-if="item.kind === 'file'"
                :id="sizeId"
                aria-hidden="true"
                :class="styles.size"
            >
                {{ formatSize(item.data.size) }}
            </span>
            <!-- the item says `aria-busy` while loading; the spinner is for the eyes -->
            <LoaderCircle
                v-if="status === 'loading'"
                aria-hidden="true"
                :class="styles.spinner"
            />
            <RetryButton
                v-if="status === 'error'"
                :item-id="item.id"
                :label="item.label"
            />
        </Tree.ItemContent>
        <Tree.Group v-slot="{ item: child }">
            <DriveItem :item="child" />
        </Tree.Group>
    </Tree.Item>
</template>
