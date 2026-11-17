<script setup lang="ts">
import { type ItemOf, useTreeState } from "@fragiola/tree-vue";
import { ChevronRight, TriangleAlert } from "@lucide/vue";
import { computed, useId } from "vue";
import KindIcon from "./kind-icon.vue";
import * as styles from "./styles";
import { Tree } from "./tree";
import {
    formatUnits,
    STORAGE_NAMES,
    type Stock,
    stockTotals,
    type WarehouseTypes,
    zoneOf,
} from "./warehouse";

const props = defineProps<{ item: ItemOf<WarehouseTypes>; zoneId: string }>();

/** A location's row: its icon, its name, and its stock (derived once per state, for every row). */
const stock = useTreeState<WarehouseTypes, Stock | undefined>(
    (_state, current) => stockTotals(current).byItemId.get(props.item.id),
);
const inZone = useTreeState<WarehouseTypes, boolean>(
    (_state, current) =>
        props.zoneId === "" ||
        zoneOf(current, props.item.id)?.id === props.zoneId,
);
// the stock describes the row; the label alone is its accessible name
const stockId = useId();
const units = computed(() => stock.value?.units ?? 0);
const lowStock = computed(
    () =>
        props.item.kind === "product" &&
        props.item.data.quantity < props.item.data.minimum,
);
const description = computed(() => {
    const item = props.item;
    if (item.kind === "product")
        return `${formatUnits(units.value)} units${lowStock.value ? `, low stock (minimum ${item.data.minimum})` : ""}, needs ${STORAGE_NAMES[item.data.storage]}`;
    if (item.kind === "bin")
        return `${Math.round((units.value / item.data.capacity) * 100)}% full, ${formatUnits(units.value)} of ${item.data.capacity} units`;
    return `${formatUnits(units.value)} units${stock.value?.low ? `, ${stock.value.low} low on stock` : ""}`;
});
const ratio = computed(() =>
    props.item.kind === "bin" ? units.value / props.item.data.capacity : 0,
);
const flagged = computed(
    () =>
        lowStock.value ||
        (props.item.kind !== "product" && (stock.value?.low ?? 0) > 0),
);
</script>

<template>
    <!-- the zone highlight is the app's: a data attribute its styles read -->
    <Tree.Item
        :item="item"
        :aria-describedby="stockId"
        :data-dimmed="inZone ? undefined : ''"
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
            <span v-else aria-hidden="true" :class="styles.units">{{ formatUnits(units) }}</span>
            <span v-if="flagged" aria-hidden="true" :class="styles.low">
                <TriangleAlert />
                <template v-if="item.kind !== 'product'">{{ stock?.low }}</template>
            </span>
        </Tree.ItemContent>
    </Tree.Item>
</template>
