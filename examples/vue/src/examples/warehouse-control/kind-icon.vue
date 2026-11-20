<script setup lang="ts">
import type { ItemOf } from "@fragiola/tree-vue";
import {
    Box,
    Columns3,
    Flame,
    Snowflake,
    ThermometerSnowflake,
    Undo2,
    Warehouse,
    Wheat,
} from "@lucide/vue";
import { computed } from "vue";
import * as styles from "./styles";
import type { Climate, ControlTypes } from "./warehouse";

const props = defineProps<{ item: ItemOf<ControlTypes> }>();

const ZONE_ICONS: Record<Climate, typeof Box> = {
    ambient: Wheat,
    cold: Snowflake,
    frozen: ThermometerSnowflake,
    hazmat: Flame,
    returns: Undo2,
};

/** Each level has its icon; a zone shows its climate, a bin what its product needs. */
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
        case "bin":
            return {
                component: Box,
                class: styles.climate[item.data.storage],
            };
    }
    return { component: Box, class: styles.icon.location };
});
</script>

<template>
    <component :is="icon.component" aria-hidden="true" :class="icon.class" />
</template>
