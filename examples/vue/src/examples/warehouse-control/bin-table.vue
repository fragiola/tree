<script setup lang="ts">
import { useTreeState } from "@fragiola/tree-vue";
import { useId } from "vue";
import * as styles from "./styles";
import { type ControlModel, formatPercent, lowestBins } from "./warehouse";

const ROWS = 8;

/** The scope's bins, lowest stock first: what to refill next. */
const props = defineProps<{ model: ControlModel; scopeId: string }>();

const titleId = useId();
const bins = useTreeState((state) => lowestBins(state, props.scopeId, ROWS), {
    model: () => props.model,
});
</script>

<template>
    <section :aria-labelledby="titleId" :class="styles.panel">
        <h2 :id="titleId" :class="styles.panelTitle">Bins, lowest stock first</h2>
        <table :aria-labelledby="titleId" :class="styles.table">
            <thead>
                <tr>
                    <th scope="col" :class="styles.headCell">Bin</th>
                    <th scope="col" :class="styles.headCell">Product</th>
                    <th scope="col" :class="styles.numberHeadCell">Units / min</th>
                    <th scope="col" :class="styles.numberHeadCell">Fill</th>
                    <th scope="col" :class="styles.headCell">State</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="bin in bins" :key="bin.id">
                    <th scope="row" :class="styles.cell">{{ bin.label }}</th>
                    <td :class="styles.cell">{{ bin.data.product }}</td>
                    <td :class="styles.numberCell">{{ bin.data.quantity }} / {{ bin.data.minimum }}</td>
                    <td :class="styles.numberCell">{{ formatPercent(bin.data.quantity / bin.data.capacity) }}</td>
                    <td :class="styles.cell">
                        <span :class="styles.badge(bin.data.quantity < bin.data.minimum)">
                            {{ bin.data.quantity < bin.data.minimum ? "Low" : "OK" }}
                        </span>
                    </td>
                </tr>
            </tbody>
        </table>
    </section>
</template>
