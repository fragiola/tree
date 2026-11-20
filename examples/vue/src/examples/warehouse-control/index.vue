<script setup lang="ts">
import {
    type AnnounceEvent,
    createTreeModel,
    useTreeState,
} from "@fragiola/tree-vue";
import { DropIndicator } from "@fragiola/tree-vue/drag-and-drop";
import { Pause, Play } from "@lucide/vue";
import {
    computed,
    onBeforeUnmount,
    onMounted,
    onScopeDispose,
    ref,
    shallowRef,
    watch,
} from "vue";
import { Clickable } from "#/components/atoms/clickable";
import {
    createStockFeed,
    formatTime,
    prefersReducedMotion,
    START_TIME,
    type StockFeed,
} from "../_kit/warehouse-live";
import BinTable from "./bin-table.vue";
import { type ControlFeaturesModel, features } from "./features";
import FillChart from "./fill-chart.vue";
import Kpis from "./kpis.vue";
import LocationItem from "./location-item.vue";
import MovementFeed from "./movement-feed.vue";
import * as styles from "./styles";
import { Tree } from "./tree";
import {
    applyMovements,
    binStocks,
    type ControlTypes,
    type LiveLog,
    logTick,
    network,
    pathOf,
    STORAGE_NAMES,
    storageRules,
} from "./warehouse";

// the model is created once, outside Vue's reactivity
const model = createTreeModel<ControlTypes, typeof features>(network(), {
    features,
});
const announce = announcer(model);
onScopeDispose(storageRules(model));

// the live feed: it plays unless the reader asked for less motion, and stops while hidden
const playing = ref(false);
const log = shallowRef<LiveLog>({ movements: [], states: [model.state] });
let feed: StockFeed | undefined;
onMounted(() => {
    playing.value = !prefersReducedMotion();
    feed = createStockFeed({
        bins: () => binStocks(model),
        autoplay: playing.value,
    });
    // each tick is one batch of commands: the tree's totals and flags follow the model
    feed.subscribe((movements) => {
        applyMovements(model, movements);
        log.value = logTick(log.value, movements, model.state);
    });
});
watch(playing, (value) => {
    if (value) feed?.play();
    else feed?.pause();
});
onBeforeUnmount(() => feed?.dispose());

// the scope of the panels: the selected location, or the whole network
const scopeId = useTreeState((state) => state.selectedItemIds[0] ?? "", {
    model,
});
const scopePath = useTreeState(
    (_state, current) => {
        const item = current.get("item-by", { id: scopeId.value });
        return item
            ? [pathOf(current, item.id), item.label].filter(Boolean).join(" › ")
            : "All sites";
    },
    { model },
);
const time = computed(() => log.value.movements[0]?.time ?? START_TIME);

/** The live region's text: each step of a drag, and why no aisle here takes a bin. */
function announcer(current: ControlFeaturesModel) {
    const label = (itemId: string | null) =>
        itemId === null
            ? "the network"
            : (current.get("item-by", { id: itemId })?.label ?? itemId);
    const needs = (itemIds: readonly string[]) => {
        const item = current.get("item-by", { id: itemIds[0] ?? "" });
        return item?.kind === "bin"
            ? ` Its product needs ${STORAGE_NAMES[item.data.storage]}.`
            : "";
    };
    return (event: AnnounceEvent): string | undefined => {
        switch (event.type) {
            case "drag-start":
                return `Picked up ${event.itemIds.map(label).join(", ")}.${needs(event.itemIds)}`;
            case "drag-over":
                return event.target
                    ? event.target.position === "inside"
                        ? `Drop into ${label(event.target.itemId)}.`
                        : `Drop ${event.target.position} ${label(event.target.itemId)}.`
                    : `No aisle here takes it.${needs(event.itemIds)}`;
            case "drop":
                return `Moved ${event.itemIds.map(label).join(", ")}.`;
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
            <p :class="styles.scope">
                <span :class="styles.scopeTerm">Scope</span>
                <span :class="styles.scopeValue" data-testid="scope">{{ scopePath }}</span>
            </p>
            <Clickable.Button
                variant="outline"
                size="sm"
                :disabled="scopeId === ''"
                @click="model.run('tree.clear-selection', {})"
            >
                All sites
            </Clickable.Button>
            <span :class="styles.status(playing)" data-testid="feed-status">
                {{ playing ? "Live" : "Paused" }} · {{ formatTime(time) }}
            </span>
            <Clickable.Button variant="outline" size="sm" @click="playing = !playing">
                <Pause v-if="playing" aria-hidden="true" />
                <Play v-else aria-hidden="true" />
                {{ playing ? "Pause" : "Play" }}
            </Clickable.Button>
        </div>
        <div :class="styles.body">
            <Tree.Root
                :model="model"
                :announce="announce"
                aria-label="Warehouse network"
                :class="styles.root"
            >
                <Tree.Items v-slot="{ item }">
                    <LocationItem :item="item" />
                </Tree.Items>
                <DropIndicator :class="styles.dropIndicator" />
                <Tree.LiveRegion :class="styles.liveRegion" />
            </Tree.Root>
            <div :class="styles.scene">
                <Kpis :model="model" :log="log" :scope-id="scopeId" />
                <div :class="styles.panels">
                    <FillChart :model="model" :scope-id="scopeId" />
                    <MovementFeed :model="model" :log="log" :scope-id="scopeId" />
                </div>
                <BinTable :model="model" :scope-id="scopeId" />
            </div>
        </div>
    </div>
</template>
