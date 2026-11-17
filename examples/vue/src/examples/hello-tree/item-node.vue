<script setup lang="ts">
import type { ItemOf } from "@fragiola/tree-vue";
import { ChevronRight } from "@lucide/vue";
import * as styles from "./styles";
import { Tree, type Types } from "./tree";

// You own the recursion: an item renders its row, then its group, which renders the children
// with this same component.
defineProps<{ item: ItemOf<Types> }>();
</script>

<template>
    <Tree.Item :item="item" :class="styles.item">
        <Tree.ItemContent :class="styles.row">
            <Tree.Toggle :class="styles.toggle">
                <ChevronRight aria-hidden="true" />
            </Tree.Toggle>
            <span :class="styles.label">{{ item.label }}</span>
        </Tree.ItemContent>
        <Tree.Group v-slot="{ item: child }">
            <ItemNode :item="child" />
        </Tree.Group>
    </Tree.Item>
</template>
