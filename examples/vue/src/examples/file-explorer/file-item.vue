<script setup lang="ts">
import type { ItemOf } from "@fragiola/tree-vue";
import { ChevronRight } from "@lucide/vue";
import { useId } from "vue";
import { type FileTypes, formatSize } from "../_kit/data";
import ItemIcon from "./item-icon.vue";
import * as styles from "./styles";
import { Tree } from "./tree";

defineProps<{ item: ItemOf<FileTypes> }>();

// the size is not part of the item's name (its row's text): it describes the item instead
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
            <ItemIcon :item="item" />
            <span :class="styles.label">{{ item.label }}</span>
            <!-- `item.kind` narrows `item.data` to `{ size: number }` -->
            <span
                v-if="item.kind === 'file'"
                :id="sizeId"
                aria-hidden="true"
                :class="styles.size"
            >
                {{ formatSize(item.data.size) }}
            </span>
        </Tree.ItemContent>
        <Tree.Group v-slot="{ item: child }">
            <FileItem :item="child" />
        </Tree.Group>
    </Tree.Item>
</template>
