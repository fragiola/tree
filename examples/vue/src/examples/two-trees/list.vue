<script setup lang="ts">
import type { AnnounceEvent, DropTarget, TreeModel } from "@fragiola/tree-vue";
import ProduceItem from "./produce-item.vue";
import * as styles from "./styles";
import { Tree, type Types } from "./tree";

// One list: a tree of the "lists" drag group.
const props = defineProps<{ model: TreeModel<Types>; name: string }>();

/** The live region's text for each step of a drag, naming the list a target is in. */
function announcer(model: TreeModel<Types>, list: string) {
    return (event: AnnounceEvent): string | undefined => {
        // a target in the other list comes with its tree: its model and its root (its name)
        const other = "targetTree" in event ? event.targetTree : undefined;
        const into = other?.model ?? model;
        const listName = other?.root.getAttribute("aria-label") ?? list;
        // the labels are read from either model's items
        const label = (
            itemId: string | null,
            from: TreeModel<Types> | TreeModel = into,
        ) =>
            itemId === null
                ? listName
                : (from.state.items[itemId]?.label ?? itemId);
        const names = (
            itemIds: readonly string[],
            from: TreeModel<Types> | TreeModel = model,
        ) => itemIds.map((itemId) => label(itemId, from)).join(", ");
        const where = (target: DropTarget) =>
            target.itemId === null
                ? `into ${listName}`
                : target.position === "inside"
                  ? `into ${label(target.itemId)} in ${listName}`
                  : `${target.position} ${label(target.itemId)} in ${listName}`;
        switch (event.type) {
            case "drag-start":
                return event.target
                    ? `Picked up ${names(event.itemIds)}. Up and Down choose a place, in either list; Enter drops, Escape cancels. Drop ${where(event.target)}.`
                    : `Picked up ${names(event.itemIds)}.`;
            case "drag-over":
                return event.target
                    ? `Drop ${where(event.target)}.`
                    : "No place to drop here.";
            case "drop":
                // the moved items are the target's now (their ids are kept)
                return `Moved ${names(event.itemIds, into)} ${where(event.target)}.`;
            case "drag-cancel":
                return `Cancelled. ${names(event.itemIds)} stayed in place.`;
            default:
                return undefined;
        }
    };
}

// the parent remounts a list (a key) when its model changes: the props are read once
const announce = announcer(props.model, props.name);
</script>

<template>
    <Tree.Root
        :model="model"
        drag-group="lists"
        :announce="announce"
        :indicator-inset="styles.indicatorInset"
        :aria-label="name"
        :class="styles.root"
    >
        <Tree.Items v-slot="{ item }">
            <ProduceItem :item="item" />
        </Tree.Items>
        <Tree.DropIndicator :class="styles.dropIndicator" />
        <Tree.LiveRegion :class="styles.liveRegion" />
    </Tree.Root>
</template>
