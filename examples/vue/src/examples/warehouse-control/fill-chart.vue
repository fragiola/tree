<script setup lang="ts">
import { useTreeState } from "@fragiola/tree-vue";
import { computed, useId } from "vue";
import * as styles from "./styles";
import {
    type ControlModel,
    type FillBar,
    fillBars,
    fillTitle,
    formatPercent,
} from "./warehouse";

/** How full each location under the scope is: one bar each, drawn as SVG. */
const props = defineProps<{ model: ControlModel; scopeId: string }>();

/** The chart's geometry, in its own units: a label column, a track, the figure. */
const WIDTH = 340;
const ROW = 22;
const LABEL = 142;
const TRACK = 140;

const titleId = useId();
const bars = useTreeState(
    (_state, current) => fillBars(current, props.scopeId),
    { model: () => props.model, isEqual: sameBars },
);
const title = computed(() => fillTitle(props.model, props.scopeId));
const summary = computed(() =>
    bars.value
        .map(
            (bar) =>
                `${bar.label} ${formatPercent(bar.units / bar.capacity)}${bar.low > 0 ? " (low stock)" : ""}`,
        )
        .join(", "),
);
const ratioOf = (bar: FillBar) =>
    bar.capacity === 0 ? 0 : bar.units / bar.capacity;
const short = (label: string) =>
    label.length > 21 ? `${label.slice(0, 20)}…` : label;

/** Two lists of bars are the same when every figure is: the chart then keeps its render. */
function sameBars(a: readonly FillBar[], b: readonly FillBar[]) {
    return (
        a.length === b.length &&
        a.every((bar, index) => {
            const other = b[index];
            return (
                other !== undefined &&
                bar.id === other.id &&
                bar.label === other.label &&
                bar.units === other.units &&
                bar.low === other.low &&
                bar.current === other.current
            );
        })
    );
}
</script>

<template>
    <section :aria-labelledby="titleId" :class="styles.panel">
        <h2 :id="titleId" :class="styles.panelTitle">{{ title }}</h2>
        <svg
            role="img"
            :aria-label="summary"
            :viewBox="`0 0 ${WIDTH} ${bars.length * ROW}`"
            :class="styles.chart"
            data-testid="fill-chart"
        >
            <g v-for="(bar, index) in bars" :key="bar.id">
                <text :x="0" :y="index * ROW + 15" :class="styles.chartLabel(bar.current)">
                    {{ short(bar.label) }}
                </text>
                <rect :x="LABEL" :y="index * ROW + 6" :width="TRACK" :height="10" :rx="2" :class="styles.chartTrack" />
                <rect
                    :x="LABEL"
                    :y="index * ROW + 6"
                    :width="Math.min(1, ratioOf(bar)) * TRACK"
                    :height="10"
                    :rx="2"
                    :class="styles.chartBar(ratioOf(bar))"
                />
                <text :x="LABEL + TRACK + 8" :y="index * ROW + 15" :class="styles.chartValue">
                    {{ formatPercent(ratioOf(bar)) }}
                </text>
                <circle v-if="bar.low > 0" :cx="WIDTH - 6" :cy="index * ROW + 11" :r="4" :class="styles.chartLow" />
            </g>
        </svg>
    </section>
</template>
