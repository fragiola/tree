<script setup lang="ts">
import type { ItemOf } from "@fragiola/tree-vue";
import { Check, ChevronRight, Minus } from "@lucide/vue";
import type { PermissionTypes } from "../_kit/data";
import * as styles from "./styles";
import { Tree } from "./tree";

defineProps<{ item: ItemOf<PermissionTypes> }>();
</script>

<template>
    <Tree.Item :item="item" :class="styles.item">
        <Tree.ItemContent :class="styles.row">
            <Tree.Toggle :class="styles.toggle">
                <ChevronRight aria-hidden="true" />
            </Tree.Toggle>
            <!-- a press toggles the check; it shows a check mark, or a dash when mixed -->
            <Tree.Checkbox :class="styles.checkbox">
                <Check aria-hidden="true" :class="styles.checkIcon" />
                <Minus aria-hidden="true" :class="styles.mixedIcon" />
            </Tree.Checkbox>
            <span :class="styles.label">{{ item.label }}</span>
        </Tree.ItemContent>
        <Tree.Group v-slot="{ item: child }">
            <PermissionItem :item="child" />
        </Tree.Group>
    </Tree.Item>
</template>
