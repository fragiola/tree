<script setup lang="ts">
import type { ItemOf } from "@fragiola/tree-vue";
import {
    Box,
    Columns3,
    Flame,
    Package,
    Rows3,
    Snowflake,
    ThermometerSnowflake,
    Undo2,
    Warehouse,
    Wheat,
} from "@lucide/vue";
import { computed } from "vue";
import * as styles from "./styles";
import type { Climate, WarehouseTypes } from "./warehouse";

const props = defineProps<{ item: ItemOf<WarehouseTypes> }>();

const ZONE_ICONS: Record<Climate, typeof Box> = {
    ambient: Wheat,
    cold: Snowflake,
    frozen: ThermometerSnowflake,
    hazmat: Flame,
    returns: Undo2,
};

/** Each level has its icon; a zone shows its climate, a product what it needs. */
const icon = computed(() => {
    const item = props.item;
    switch (item.kind) {
        case "site":
            return { component: Warehouse, class: styles.icon.site };
        case "zone":
            return {
                component: ZONE_ICONS[item.data.climate],
                class: styles.climate[item.data.climate],
            };
        case "aisle":
            return { component: Columns3, class: styles.icon.location };
        case "rack":
            return { component: Rows3, class: styles.icon.location };
        case "bin":
            return { component: Box, class: styles.icon.location };
        case "product":
            return {
                component: Package,
                class: styles.climate[item.data.storage],
            };
    }
    return { component: Box, class: styles.icon.location };
});
</script>

<template>
    <component :is="icon.component" aria-hidden="true" :class="icon.class" />
</template>
