<script setup lang="ts">
import { useTreeState } from "@fragiola/tree-vue";
import { computed } from "vue";
import type { WarehouseModel } from "./features";
import ProductActions from "./product-actions.vue";
import * as styles from "./styles";
import {
    ancestorIds,
    formatUnits,
    STORAGE_NAMES,
    stockTotals,
} from "./warehouse";

const props = defineProps<{ model: WarehouseModel }>();

/** The selected location or product: where it is, its stock, and what can be done with it. */
// the selection is the tree's: one item at a time, read from the model
const item = useTreeState(
    (state, current) => {
        const [selectedId] = state.selectedItemIds;
        return selectedId === undefined
            ? undefined
            : current.get("item-by", { id: selectedId });
    },
    { model: props.model },
);
const stock = useTreeState(
    (_state, current) =>
        item.value
            ? stockTotals(current).byItemId.get(item.value.id)
            : undefined,
    { model: props.model },
);
const path = useTreeState(
    (_state, current) =>
        item.value
            ? ancestorIds(current, item.value.id)
                  .map((id) => current.get("item-by", { id })?.label ?? id)
                  .join(" › ")
            : "",
    { model: props.model },
);
const units = computed(() => stock.value?.units ?? 0);
</script>

<template>
    <section aria-label="Details" :class="styles.details">
        <template v-if="item">
            <p :class="styles.path">{{ path }}</p>
            <h2 :class="styles.title">{{ item.label }}</h2>
            <dl :class="styles.facts">
                <template v-if="item.kind === 'product'">
                    <div :class="styles.fact">
                        <dt :class="styles.term">SKU</dt>
                        <dd :class="styles.value">{{ item.data.sku }}</dd>
                    </div>
                    <div :class="styles.fact">
                        <dt :class="styles.term">Needs</dt>
                        <dd :class="styles.value">{{ STORAGE_NAMES[item.data.storage] }}</dd>
                    </div>
                    <div :class="styles.fact">
                        <dt :class="styles.term">Minimum</dt>
                        <dd :class="styles.value">{{ item.data.minimum }} units</dd>
                    </div>
                </template>
                <template v-else-if="item.kind === 'bin'">
                    <div :class="styles.fact">
                        <dt :class="styles.term">Fill</dt>
                        <dd :class="styles.value">
                            {{ formatUnits(units) }} of {{ item.data.capacity }} units
                        </dd>
                    </div>
                    <div :class="styles.fact">
                        <dt :class="styles.term">Products</dt>
                        <dd :class="styles.value">{{ item.childItemIds?.length ?? 0 }}</dd>
                    </div>
                </template>
                <template v-else>
                    <div :class="styles.fact">
                        <dt :class="styles.term">Units</dt>
                        <dd :class="styles.value">{{ formatUnits(units) }}</dd>
                    </div>
                    <div :class="styles.fact">
                        <dt :class="styles.term">Low on stock</dt>
                        <dd :class="styles.value">{{ stock?.low ?? 0 }}</dd>
                    </div>
                </template>
            </dl>
            <ProductActions v-if="item.kind === 'product'" :key="item.id" :model="model" :item="item" />
        </template>
        <p v-else :class="styles.empty">Select a location or a product.</p>
    </section>
</template>
