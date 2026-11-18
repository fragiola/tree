<script setup lang="ts">
import { type ItemOf, useTree, useTreeState } from "@fragiola/tree-vue";
import { useTreeItemRename } from "@fragiola/tree-vue/rename";
import {
    ArrowDown,
    ArrowUp,
    CalendarX,
    ChevronRight,
    ChevronsUp,
    Circle,
    CircleCheck,
    CircleDashed,
    CircleDot,
    FolderKanban,
    Layers,
    Minus,
} from "@lucide/vue";
import { computed, useId } from "vue";
import {
    type BoardTypes,
    describe,
    isOverdue,
    type matchesOf,
    personOf,
    progressOf,
    type Status,
    statusOf,
} from "./board";
import CheckControl from "./check-control.vue";
import type { BoardFeatures } from "./model";
import * as styles from "./styles";
import { Tree } from "./tree";

const props = defineProps<{
    item: ItemOf<BoardTypes>;
    matches: ReturnType<typeof matchesOf>;
}>();
const emit = defineEmits<{ addAfter: [itemId: string] }>();

const STATUS_ICONS: Record<Status, typeof Circle> = {
    todo: Circle,
    doing: CircleDashed,
    review: CircleDot,
    done: CircleCheck,
};

const PRIORITY_ICONS = {
    low: ArrowDown,
    medium: Minus,
    high: ArrowUp,
    urgent: ChevronsUp,
} as const;

/** A row: the check (done), the kind or status, the name, then priority, assignee, due date or progress. */
const { model } = useTree<BoardTypes, BoardFeatures>();
// the app's own input edits the name: Enter commits, Escape cancels
const { state: rename, props: renameProps } = useTreeItemRename(
    () => props.item,
);
// the row's status and description, read from the model (a check or a subtask changes them)
const status = useTreeState<BoardTypes, Status, BoardFeatures>(
    (_state, current) => statusOf(current, props.item.id),
);
const description = useTreeState<BoardTypes, string, BoardFeatures>(
    (_state, current) => describe(current, props.item),
);
const progress = useTreeState<BoardTypes, string, BoardFeatures>(
    (_state, current) => {
        const { done, total } = progressOf(current, props.item.id);
        const item = props.item;
        return item.kind === "project" ||
            item.kind === "epic" ||
            (item.childItemIds?.length ?? 0) > 0
            ? `${done}/${total}`
            : "";
    },
);
const descriptionId = useId();
const dimmed = computed(
    () =>
        props.matches.active &&
        !props.matches.matchIds.has(props.item.id) &&
        !props.matches.aroundIds.has(props.item.id),
);
const work = computed(() =>
    props.item.kind === "task" || props.item.kind === "subtask"
        ? props.item
        : undefined,
);
const person = computed(() => personOf(work.value?.data.assigneeId ?? null));

const startRename = () =>
    model.run("item.start-rename", { itemId: props.item.id });

// a new task, named with Enter: the next one, right after it
const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    queueMicrotask(() => {
        if (model.state.renamingItemId === null)
            emit("addAfter", props.item.id);
    });
};
</script>

<template>
    <!-- the filters' highlight is the app's: a data attribute its styles read -->
    <Tree.Item
        :item="item"
        :aria-describedby="descriptionId"
        :data-dimmed="dimmed ? '' : undefined"
        :class="styles.item"
    >
        <Tree.ItemContent :class="styles.row" @dblclick="startRename">
            <Tree.Toggle :class="styles.toggle">
                <ChevronRight aria-hidden="true" />
            </Tree.Toggle>
            <CheckControl :item="item" />
            <FolderKanban v-if="item.kind === 'project'" aria-hidden="true" :class="styles.kindIcon.project" />
            <Layers v-else-if="item.kind === 'epic'" aria-hidden="true" :class="styles.kindIcon.epic" />
            <component :is="STATUS_ICONS[status]" v-else aria-hidden="true" :class="styles.statusIcon[status]" />
            <span :class="styles.label">{{ item.label }}</span>
            <input
                v-if="rename.renaming"
                v-bind="renameProps"
                :aria-label="`Rename ${item.label}`"
                :class="styles.input"
                @keydown="onKeydown"
            />
            <span :id="descriptionId" hidden>{{ description }}</span>
            <span v-if="progress !== ''" aria-hidden="true" :class="styles.progress">{{ progress }}</span>
            <!-- a task's marks, for the eyes (its description says them): overdue, priority, assignee -->
            <template v-if="work">
                <CalendarX v-if="status !== 'done' && isOverdue(work)" aria-hidden="true" :class="styles.overdue" />
                <component
                    :is="PRIORITY_ICONS[work.data.priority]"
                    aria-hidden="true"
                    :class="styles.priority[work.data.priority]"
                />
                <span aria-hidden="true" :title="person?.name ?? 'Unassigned'" :class="styles.avatar">
                    {{ person?.initials ?? "–" }}
                </span>
            </template>
        </Tree.ItemContent>
        <Tree.Group v-slot="{ item: child }">
            <WorkItem :item="child" :matches="matches" @add-after="(itemId) => emit('addAfter', itemId)" />
        </Tree.Group>
    </Tree.Item>
</template>
