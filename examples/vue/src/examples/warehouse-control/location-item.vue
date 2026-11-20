<script setup lang="ts">
import { type ItemOf, useTreeState } from "@fragiola/tree-vue";
import { ChevronRight, TriangleAlert } from "@lucide/vue";
import { useId } from "vue";
import KindIcon from "./kind-icon.vue";
import * as styles from "./styles";
import { Tree } from "./tree";
import { type ControlTypes, describe, stockIn } from "./warehouse";

/** A location and its children: its icon, its name, its stock and its low-stock flag. */
const props = defineProps<{ item: ItemOf<ControlTypes> }>();

// the stock is derived once per state, for every row; the description is the row's figures
const description = useTreeState<ControlTypes, string>((state) =>
    describe(state, props.item.id),
);
const ratio = useTreeState<ControlTypes, number>((state) => {
    const stock = stockIn(state, props.item.id);
    return stock.capacity === 0 ? 0 : stock.units / stock.capacity;
});
const low = useTreeState<ControlTypes, number>(
    (state) => stockIn(state, props.item.id).low,
);
const stockId = useId();
</script>

<template>
    <!-- the flag is the app's: a data attribute its styles (and the spec) read -->
    <Tree.Item
        :item="item"
        :aria-describedby="stockId"
        :data-low="low > 0 ? '' : undefined"
        :class="styles.item"
    >
        <Tree.ItemContent :class="styles.row">
            <Tree.Toggle :class="styles.toggle">
                <ChevronRight aria-hidden="true" />
            </Tree.Toggle>
            <KindIcon :item="item" />
            <span :class="styles.label">{{ item.label }}</span>
            <span :id="stockId" hidden>{{ description }}</span>
            <span v-if="item.kind === 'bin'" aria-hidden="true" :class="styles.fill">
                <span
                    :class="styles.fillBar(ratio)"
                    :style="{ width: `${Math.min(100, ratio * 100)}%` }"
                />
            </span>
            <span v-else aria-hidden="true" :class="styles.units">{{ Math.round(ratio * 100) }}%</span>
            <span v-if="low > 0" aria-hidden="true" :class="styles.low">
                <TriangleAlert />
                <template v-if="item.kind !== 'bin'">{{ low }}</template>
            </span>
        </Tree.ItemContent>
        <Tree.Group v-slot="{ item: child }">
            <LocationItem :item="child" />
        </Tree.Group>
    </Tree.Item>
</template>
