<script setup lang="ts">
import {
    type AnnounceEvent,
    useTreeRef,
    useTreeState,
} from "@fragiola/tree-vue";
import { DropIndicator } from "@fragiola/tree-vue/drag-and-drop";
import { ListTree, Plus, Redo2, Undo2 } from "@lucide/vue";
import { onScopeDispose, ref, shallowRef } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { UndoManager } from "../_kit/undo";
import {
    addTask,
    type BoardTypes,
    expandTo,
    type Filters,
    matchesOf,
    PEOPLE,
    STATUS_NAMES,
    STATUSES,
    statusOf,
    structureRules,
} from "./board";
import BoardView from "./board-view.vue";
import { type BoardFeatures, type BoardModel, createBoardModel } from "./model";
import * as styles from "./styles";
import { Tree } from "./tree";
import WorkItem from "./work-item.vue";

// the model is created once, outside Vue's reactivity
const model = createBoardModel();
// undo/redo is app code (`_kit/undo.ts`): every step, one command or one batch
const history = new UndoManager(model);
const snapshot = shallowRef(history.getSnapshot());
onScopeDispose(
    history.subscribe(() => {
        snapshot.value = history.getSnapshot();
    }),
);
const announce = announcer(model);
const tree = useTreeRef<BoardTypes, BoardFeatures>();
onScopeDispose(structureRules(model));
// the filters highlight the work they match; the tree is not filtered
const filters = ref<Filters>({ assigneeId: "", status: "" });
const matches = useTreeState(
    (_state, current) => matchesOf(current, filters.value),
    {
        model,
    },
);
// the tasks added from the toolbar: Enter on one, once named, adds the next
const added = new Set<string>();

function add(afterItemId?: string) {
    const id = addTask(model, afterItemId);
    if (id) added.add(id);
}

function setStatusFilter(value: string) {
    filters.value = {
        ...filters.value,
        status: STATUSES.find((status) => status === value) ?? "",
    };
}

// the app's shortcuts on the tree: Ctrl/⌘+Z undoes, with Shift (or Ctrl+Y) redoes
function onKeydown(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement) return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (mod && key === "z") history[event.shiftKey ? "redo" : "undo"]();
    else if (mod && key === "y") history.redo();
    else return;
    event.preventDefault();
}

/** The live region's text: drags inside the tree and onto the board (the package writes none). */
function announcer(current: BoardModel) {
    const label = (itemId: string | null) =>
        itemId === null
            ? "the top"
            : (current.get("item-by", { id: itemId })?.label ?? itemId);
    const names = (itemIds: readonly string[]) => itemIds.map(label).join(", ");
    return (event: AnnounceEvent): string | undefined => {
        switch (event.type) {
            case "drag-start":
                return `Picked up ${names(event.itemIds)}. Drop it in the tree, or on a board column.`;
            case "drop":
                return `Moved ${names(event.itemIds)} ${
                    event.target.position === "inside"
                        ? `into ${label(event.target.itemId)}`
                        : `${event.target.position} ${label(event.target.itemId)}`
                }.`;
            case "drop-outside":
                return `${names(event.itemIds)}: ${STATUS_NAMES[statusOf(current, event.itemIds[0] ?? "")]}.`;
            case "drag-cancel":
                return "Move cancelled.";
            default:
                return undefined;
        }
    };
}
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <Clickable.Button variant="outline" size="sm" :disabled="!snapshot.canUndo" @click="history.undo()">
                <Undo2 aria-hidden="true" />
                Undo
            </Clickable.Button>
            <Clickable.Button variant="outline" size="sm" :disabled="!snapshot.canRedo" @click="history.redo()">
                <Redo2 aria-hidden="true" />
                Redo
            </Clickable.Button>
            <Clickable.Button variant="outline" size="sm" @click="add()">
                <Plus aria-hidden="true" />
                Add task
            </Clickable.Button>
            <select v-model="filters.assigneeId" aria-label="Filter by assignee" :class="styles.select">
                <option value="">Anyone</option>
                <option v-for="person in PEOPLE" :key="person.id" :value="person.id">{{ person.name }}</option>
            </select>
            <select
                :value="filters.status"
                aria-label="Filter by status"
                :class="styles.select"
                @change="setStatusFilter(($event.target as HTMLSelectElement).value)"
            >
                <option value="">Any status</option>
                <option v-for="status in STATUSES" :key="status" :value="status">{{ STATUS_NAMES[status] }}</option>
            </select>
            <template v-if="matches.active">
                <span :class="styles.matches" data-testid="matches">
                    {{ matches.matchIds.size }} {{ matches.matchIds.size === 1 ? "match" : "matches" }}
                </span>
                <Clickable.Button variant="outline" size="sm" @click="expandTo(model, matches.aroundIds)">
                    <ListTree aria-hidden="true" />
                    Expand to matches
                </Clickable.Button>
            </template>
        </div>
        <div :class="styles.body">
            <Tree.Root
                :model="model"
                :tree-ref="tree"
                :announce="announce"
                aria-label="Projects"
                :class="styles.root"
                @keydown="onKeydown"
            >
                <Tree.Items v-slot="{ item }">
                    <WorkItem :item="item" :matches="matches" @add-after="(itemId) => added.has(itemId) && add(itemId)" />
                </Tree.Items>
                <!-- where the drop lands: a line before or after a row, or the box of a parent -->
                <DropIndicator :class="styles.dropIndicator" />
                <Tree.LiveRegion :class="styles.liveRegion" />
            </Tree.Root>
            <BoardView :model="model" :tree="tree" />
        </div>
    </div>
</template>
