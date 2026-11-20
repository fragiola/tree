<script setup lang="ts">
import { useTreeState } from "@fragiola/tree-vue";
import { computed } from "vue";
import * as styles from "./styles";
import {
    type ControlModel,
    formatPercent,
    formatUnits,
    type LiveLog,
    stockIn,
    unitsMoved,
} from "./warehouse";

/** The scope's key figures: what is on hand, how full it is, what is low, what moved. */
const props = defineProps<{
    model: ControlModel;
    log: LiveLog;
    scopeId: string;
}>();

const units = useTreeState((state) => stockIn(state, props.scopeId).units, {
    model: () => props.model,
});
const capacity = useTreeState(
    (state) => stockIn(state, props.scopeId).capacity,
    { model: () => props.model },
);
const bins = useTreeState((state) => stockIn(state, props.scopeId).bins, {
    model: () => props.model,
});
const low = useTreeState((state) => stockIn(state, props.scopeId).low, {
    model: () => props.model,
});
const moved = computed(() => unitsMoved(props.model, props.log, props.scopeId));

/** The sparkline: a line over the last values, scaled to their range (SVG, no chart library). */
const points = computed(() => {
    const values = props.log.states.map(
        (state) => stockIn(state, props.scopeId).units,
    );
    if (values.length < 2) return "0,12 100,12";
    const min = Math.min(...values);
    const range = Math.max(...values) - min || 1;
    const step = 100 / (values.length - 1);
    return values
        .map(
            (value, index) =>
                `${(index * step).toFixed(1)},${(22 - ((value - min) / range) * 20).toFixed(1)}`,
        )
        .join(" ");
});
</script>

<template>
    <section aria-label="Key figures">
        <dl :class="styles.kpis">
            <div :class="styles.kpi">
                <dt :class="styles.kpiTerm">Units on hand</dt>
                <dd :class="styles.kpiValue" data-testid="kpi-units">{{ formatUnits(units) }}</dd>
                <dd aria-hidden="true" :class="styles.kpiNote(false)">
                    <svg aria-hidden="true" viewBox="0 0 100 24" preserveAspectRatio="none" :class="styles.spark">
                        <polyline :points="points" vector-effect="non-scaling-stroke" :class="styles.sparkLine" />
                    </svg>
                </dd>
            </div>
            <div :class="styles.kpi">
                <dt :class="styles.kpiTerm">Fill</dt>
                <dd :class="styles.kpiValue" data-testid="kpi-fill">{{ formatPercent(units / capacity) }}</dd>
                <dd :class="styles.kpiNote(false)">of {{ formatUnits(capacity) }} units</dd>
            </div>
            <div :class="styles.kpi">
                <dt :class="styles.kpiTerm">Low-stock bins</dt>
                <dd :class="styles.kpiValue" data-testid="kpi-low">{{ low }}</dd>
                <dd :class="styles.kpiNote(low > 0)">of {{ bins }} bins</dd>
            </div>
            <div :class="styles.kpi">
                <dt :class="styles.kpiTerm">Moved, last minute</dt>
                <dd :class="styles.kpiValue" data-testid="kpi-moved">{{ formatUnits(moved) }}</dd>
                <dd :class="styles.kpiNote(false)">units in and out</dd>
            </div>
        </dl>
    </section>
</template>
