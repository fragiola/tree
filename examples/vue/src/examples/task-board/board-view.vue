<script setup lang="ts">
import { type TreeRef, useTreeState } from "@fragiola/tree-vue";
import { ArrowLeft, ArrowRight } from "@lucide/vue";
import { ref, watchEffect } from "vue";
import {
    type BoardTypes,
    columnsOf,
    neighbours,
    PEOPLE,
    progressOf,
    STATUS_NAMES,
    scopeOf,
    setStatus,
} from "./board";
import type { BoardFeatures, BoardModel } from "./model";
import * as styles from "./styles";

const props = defineProps<{
    model: BoardModel;
    tree: TreeRef<BoardTypes, BoardFeatures>;
}>();

/**
 * The board: the tasks of the selected project or epic in four columns, read from the model. A
 * tree row dropped on a column moves to its status (the model's `dropOutside()`, which finds the
 * column by `data-status-column`); a card's buttons move it one column. Both run commands.
 */
const scope = useTreeState((_state, current) => scopeOf(current)?.label ?? "", {
    model: props.model,
});
const columns = useTreeState(
    (_state, current) =>
        columnsOf(current).map(({ status, cards }) => ({
            status,
            ...neighbours(status),
            cards: cards.map((card) => {
                const { done, total } = progressOf(current, card.id);
                const assigneeId =
                    card.kind === "task" ? card.data.assigneeId : null;
                return {
                    id: card.id,
                    label: card.label,
                    person:
                        PEOPLE.find((person) => person.id === assigneeId)
                            ?.name ?? "Unassigned",
                    progress: total > 1 ? `${done}/${total} done` : "",
                };
            }),
        })),
    { model: props.model },
);

/**
 * The column a tree row is dragged over: `drop-outside-element` is the element under the pointer
 * while a drag is outside the tree (the pointer stays captured by the row, so the column gets no
 * pointer events of its own).
 */
const over = ref<string | null>(null);
watchEffect((onCleanup) => {
    const engine = props.tree.value?.engine;
    if (!engine) return;
    onCleanup(
        engine.subscribe(() => {
            over.value =
                engine
                    .get("drop-outside-element")
                    ?.closest("[data-status-column]")
                    ?.getAttribute("data-status-column") ?? null;
        }),
    );
});
</script>

<template>
    <section aria-label="Board" :class="styles.board">
        <h2 :class="styles.boardTitle">{{ scope }}</h2>
        <div :class="styles.columns">
            <section
                v-for="column in columns"
                :key="column.status"
                :aria-label="STATUS_NAMES[column.status]"
                :data-status-column="column.status"
                :data-over="over === column.status ? '' : undefined"
                :class="styles.column"
            >
                <h3 :class="styles.columnTitle">
                    {{ STATUS_NAMES[column.status] }}
                    <span>{{ column.cards.length }}</span>
                </h3>
                <ul :class="styles.cards">
                    <li v-if="column.cards.length === 0" :class="styles.empty">Drop a task here</li>
                    <li v-for="card in column.cards" :key="card.id" data-testid="card" :class="styles.card">
                        {{ card.label }}
                        <div :class="styles.cardMeta">
                            <span :class="styles.cardPerson">{{ card.person }}</span>
                            <span v-if="card.progress !== ''" :class="styles.cardProgress">{{ card.progress }}</span>
                            <span :class="styles.cardActions">
                                <button
                                    v-if="column.previous"
                                    type="button"
                                    :aria-label="`Move ${card.label} to ${STATUS_NAMES[column.previous]}`"
                                    :class="styles.cardButton"
                                    @click="column.previous && setStatus(model, [card.id], column.previous)"
                                >
                                    <ArrowLeft aria-hidden="true" />
                                </button>
                                <button
                                    v-if="column.next"
                                    type="button"
                                    :aria-label="`Move ${card.label} to ${STATUS_NAMES[column.next]}`"
                                    :class="styles.cardButton"
                                    @click="column.next && setStatus(model, [card.id], column.next)"
                                >
                                    <ArrowRight aria-hidden="true" />
                                </button>
                            </span>
                        </div>
                    </li>
                </ul>
            </section>
        </div>
    </section>
</template>
