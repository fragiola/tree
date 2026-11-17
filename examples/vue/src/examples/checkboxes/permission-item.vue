<script setup lang="ts">
import { type ItemOf, useTree, useTreeItem } from "@fragiola/tree-vue";
import { Check, ChevronRight, Minus } from "@lucide/vue";
import type { PermissionTypes } from "../_kit/data";
import * as styles from "./styles";
import { type features, Tree } from "./tree";

const props = defineProps<{ item: ItemOf<PermissionTypes> }>();
const { model } = useTree<PermissionTypes, typeof features>();
const { state } = useTreeItem(() => props.item);
// a press toggles the item's check (`item.toggle-check`, with the cascade)
const toggleCheck = () =>
    model.run("item.toggle-check", { itemId: props.item.id });
</script>

<template>
    <Tree.Item :item="item" :class="styles.item">
        <Tree.ItemContent :class="styles.row">
            <Tree.Toggle :class="styles.toggle">
                <ChevronRight aria-hidden="true" />
            </Tree.Toggle>
            <!--
                the app's own check control: a check mark, or a dash when mixed. The item carries
                aria-checked and Space toggles it, so the box is a span hidden from assistive
                technology that never takes focus (a press focuses the item, and the arrows keep
                working); data-tree-no-drag keeps a press from dragging or selecting
            -->
            <span
                aria-hidden="true"
                data-tree-no-drag
                data-testid="check"
                :data-checked="state.checked ? '' : undefined"
                :data-indeterminate="state.indeterminate ? '' : undefined"
                :data-disabled="state.disabled ? '' : undefined"
                :class="styles.checkbox"
                @click="toggleCheck"
            >
                <Check aria-hidden="true" :class="styles.checkIcon" />
                <Minus aria-hidden="true" :class="styles.mixedIcon" />
            </span>
            <span :class="styles.label">{{ item.label }}</span>
        </Tree.ItemContent>
        <Tree.Group v-slot="{ item: child }">
            <PermissionItem :item="child" />
        </Tree.Group>
    </Tree.Item>
</template>
