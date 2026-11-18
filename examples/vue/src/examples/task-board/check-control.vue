<script setup lang="ts">
import { type ItemOf, useTree, useTreeItem } from "@fragiola/tree-vue";
import { Check, Minus } from "@lucide/vue";
import type { BoardTypes } from "./board";
import type { BoardFeatures } from "./model";
import * as styles from "./styles";

const props = defineProps<{ item: ItemOf<BoardTypes> }>();

/**
 * The app's own check control: a press toggles the item's check (`item.toggle-check`, with the
 * cascade): a checked task is done. The item carries `aria-checked` and Space toggles it, so the box
 * is hidden from assistive technology and never takes focus; `data-tree-no-drag` keeps a press from
 * dragging or selecting.
 */
const { model } = useTree<BoardTypes, BoardFeatures>();
const { state } = useTreeItem(() => props.item);
const toggle = () => model.run("item.toggle-check", { itemId: props.item.id });
</script>

<template>
    <span
        aria-hidden="true"
        data-tree-no-drag=""
        data-testid="check"
        :data-checked="state.checked ? '' : undefined"
        :data-indeterminate="state.indeterminate ? '' : undefined"
        :class="styles.checkbox"
        @click="toggle"
    >
        <Check aria-hidden="true" :class="styles.checkIcon" />
        <Minus aria-hidden="true" :class="styles.mixedIcon" />
    </span>
</template>
