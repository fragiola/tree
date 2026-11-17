<script setup lang="ts">
import type { ItemOf } from "@fragiola/tree-vue";
import { ChevronRight, Folder, GripVertical, Leaf } from "@lucide/vue";
import * as styles from "./styles";
import { Tree, type Types } from "./tree";

defineProps<{ item: ItemOf<Types> }>();
</script>

<template>
    <Tree.Item :item="item" :class="styles.item">
        <Tree.ItemContent :class="styles.row">
            <GripVertical aria-hidden="true" :class="styles.grip" />
            <Tree.Toggle :class="styles.toggle">
                <ChevronRight aria-hidden="true" />
            </Tree.Toggle>
            <Folder
                v-if="item.kind === 'group'"
                aria-hidden="true"
                :class="styles.groupIcon"
            />
            <Leaf v-else aria-hidden="true" :class="styles.produceIcon" />
            <span :class="styles.label">{{ item.label }}</span>
        </Tree.ItemContent>
        <Tree.Group v-slot="{ item: child }">
            <ProduceItem :item="child" />
        </Tree.Group>
    </Tree.Item>
</template>
