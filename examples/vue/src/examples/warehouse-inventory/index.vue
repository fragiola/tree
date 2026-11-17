<script setup lang="ts">
import {
    type AnnounceEvent,
    createTreeModel,
    useTreeState,
} from "@fragiola/tree-vue";
import { DropIndicator } from "@fragiola/tree-vue/drag-and-drop";
import { ChevronsDownUp, ListChecks, TriangleAlert } from "@lucide/vue";
import { onScopeDispose, ref } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import Details from "./details.vue";
import { features, type WarehouseModel } from "./features";
import LocationRow from "./location-row.vue";
import * as styles from "./styles";
import { Tree, VirtualItems } from "./tree";
import {
    expandToLowStock,
    STORAGE_NAMES,
    stockTotals,
    storageRules,
    type WarehouseTypes,
    warehouse,
} from "./warehouse";

const ZONE_OPTIONS = [
    { id: "", label: "All zones" },
    { id: "dry", label: "Dry goods" },
    { id: "cold", label: "Cold storage" },
    { id: "frozen", label: "Freezer" },
    { id: "hazmat", label: "Hazmat cage" },
    { id: "returns", label: "Returns" },
];

// the model is created once, outside Vue's reactivity
const model = createTreeModel<WarehouseTypes, typeof features>(warehouse(), {
    features,
});
const announce = announcer(model);
onScopeDispose(storageRules(model));
// the zone the app highlights: its rows stay, the others dim (the tree is not filtered)
const zoneId = ref("");
const low = useTreeState(
    (_state, current) => stockTotals(current).lowProductIds.length,
    { model },
);

/** The live region's text: each step of a drag, and why nothing takes a product here. */
function announcer(current: WarehouseModel) {
    const label = (itemId: string | null) =>
        itemId === null
            ? "the warehouse"
            : (current.get("item-by", { id: itemId })?.label ?? itemId);
    const needs = (itemIds: readonly string[]) => {
        const item = current.get("item-by", { id: itemIds[0] ?? "" });
        return item?.kind === "product"
            ? ` It needs ${STORAGE_NAMES[item.data.storage]}.`
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
                    : `No bin here takes it.${needs(event.itemIds)}`;
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
            <Clickable.Button variant="outline" size="sm" @click="expandToLowStock(model)">
                <ListChecks aria-hidden="true" />
                Expand to low stock
            </Clickable.Button>
            <Clickable.Button variant="outline" size="sm" @click="model.run('tree.collapse-all', {})">
                <ChevronsDownUp aria-hidden="true" />
                Collapse all
            </Clickable.Button>
            <select v-model="zoneId" aria-label="Highlight zone" :class="styles.select">
                <option v-for="zone in ZONE_OPTIONS" :key="zone.id" :value="zone.id">
                    {{ zone.label }}
                </option>
            </select>
            <span :class="styles.lowCount" data-testid="low-stock">
                <TriangleAlert aria-hidden="true" />
                {{ low }} low on stock
            </span>
        </div>
        <div :class="styles.body">
            <Tree.Root
                :model="model"
                :announce="announce"
                aria-label="Warehouse locations"
                :class="styles.root"
            >
                <!-- flat rows: each item carries its level, position and set size; no Tree.Group -->
                <VirtualItems v-slot="{ item }">
                    <LocationRow :item="item" :zone-id="zoneId" />
                </VirtualItems>
                <DropIndicator :class="styles.dropIndicator" />
                <Tree.LiveRegion :class="styles.liveRegion" />
            </Tree.Root>
            <Details :model="model" />
        </div>
    </div>
</template>
