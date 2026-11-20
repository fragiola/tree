<script setup lang="ts">
import { ArrowDownToLine, ArrowUpFromLine } from "@lucide/vue";
import { computed, useId } from "vue";
import { formatTime } from "../_kit/warehouse-live";
import * as styles from "./styles";
import { type ControlModel, type LiveLog, movementsIn } from "./warehouse";

const SHOWN = 7;

/** The scope's last stock movements, newest first. */
const props = defineProps<{
    model: ControlModel;
    log: LiveLog;
    scopeId: string;
}>();

const titleId = useId();
const movements = computed(() =>
    movementsIn(props.model, props.log, props.scopeId)
        .slice(0, SHOWN)
        .map((movement) => {
            const bin = props.model.get("item-by", { id: movement.binId });
            return {
                ...movement,
                bin: `${bin?.label ?? movement.binId}${bin?.kind === "bin" ? ` · ${bin.data.product}` : ""}`,
                change:
                    movement.delta > 0
                        ? `+${movement.delta}`
                        : `−${-movement.delta}`,
            };
        }),
);
</script>

<template>
    <section :aria-labelledby="titleId" :class="styles.panel">
        <h2 :id="titleId" :class="styles.panelTitle">Stock movements</h2>
        <p v-if="movements.length === 0" :class="styles.empty">No movement yet.</p>
        <ol v-else :aria-labelledby="titleId" :class="styles.feed">
            <li v-for="movement in movements" :key="movement.id" :class="styles.movement">
                <span :class="styles.movementTime">{{ formatTime(movement.time) }}</span>
                <ArrowUpFromLine v-if="movement.kind === 'pick'" aria-hidden="true" :class="styles.movementIcon(movement.kind)" />
                <ArrowDownToLine v-else aria-hidden="true" :class="styles.movementIcon(movement.kind)" />
                <span :class="styles.srOnly">{{ movement.kind === "pick" ? "Pick" : "Receipt" }}</span>
                <span :class="styles.movementBin">{{ movement.bin }}</span>
                <span :class="styles.movementDelta(movement.kind)">{{ movement.change }}</span>
            </li>
        </ol>
    </section>
</template>
