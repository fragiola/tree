<script setup lang="ts">
import {
    type AnnounceEvent,
    createTreeModel,
    type DropTarget,
    type TreeJson,
    type TreeModel,
} from "@fragiola/tree-vue";
import { Lock } from "@lucide/vue";
import { useId } from "vue";
import FileItem from "./file-item.vue";
import * as styles from "./styles";
import { features, Tree, type Types } from "./tree";

// The permission flags are part of the document, and the commands enforce them: `movable: false`
// keeps an item in place, `droppable: false` keeps a folder closed to drops. A drag asks
// `model.can("item.move", …)` for every target, so a refused one never shows.
const json: TreeJson<Types> = {
    version: 1,
    rootItemIds: ["src", "docs", "vendor", "license", "readme"],
    items: {
        src: {
            kind: "folder",
            label: "src",
            childItemIds: ["app", "main", "routes"],
        },
        app: { kind: "file", label: "app.tsx" },
        main: { kind: "file", label: "main.tsx" },
        routes: { kind: "folder", label: "routes", childItemIds: ["home"] },
        home: { kind: "file", label: "home.tsx" },
        docs: { kind: "folder", label: "docs", childItemIds: ["guide", "api"] },
        guide: { kind: "file", label: "guide.md" },
        api: { kind: "file", label: "api.md" },
        vendor: {
            kind: "folder",
            label: "vendor",
            droppable: false,
            childItemIds: ["polyfill"],
        },
        polyfill: { kind: "file", label: "polyfill.js", movable: false },
        license: { kind: "file", label: "LICENSE", movable: false },
        readme: { kind: "file", label: "README.md" },
    },
    expandedItemIds: ["src", "docs", "vendor"],
};

/** The live region's text for each step of a drag (pointer or keyboard): the package writes none. */
function announcer(model: TreeModel<Types>) {
    const label = (itemId: string | null) =>
        itemId === null
            ? "the tree"
            : (model.get("item-by", { id: itemId })?.label ?? itemId);
    const names = (itemIds: readonly string[]) =>
        itemIds.map((itemId) => label(itemId)).join(", ");
    const where = (target: DropTarget) =>
        target.position === "inside"
            ? `into ${label(target.itemId)}`
            : `${target.position} ${label(target.itemId)}`;
    return (event: AnnounceEvent): string | undefined => {
        switch (event.type) {
            case "drag-start":
                // a keyboard drag's start comes with its first place, said in one message
                return event.target
                    ? `Picked up ${names(event.itemIds)}. Up and Down choose a place, Enter drops, Escape cancels. Drop ${where(event.target)}.`
                    : `Picked up ${names(event.itemIds)}.`;
            case "drag-over":
                return event.target
                    ? `Drop ${where(event.target)}.`
                    : "No place to drop here.";
            case "drop":
                return `Moved ${names(event.itemIds)} ${where(event.target)}.`;
            case "drag-cancel":
                return `Cancelled. ${names(event.itemIds)} stayed in place.`;
            default:
                return undefined;
        }
    };
}

// The model is the source of truth: create it once (never in a ref).
const model = createTreeModel<Types, typeof features>(json, { features });
const announce = announcer(model);
// one description for every locked item, referenced by id (hidden, still read)
const lockedId = useId();
</script>

<template>
    <div :class="styles.frame">
        <Tree.Root
            :indicator-inset="styles.indicatorInset"
            :model="model"
            :announce="announce"
            aria-label="Project files"
            :class="styles.root"
        >
            <Tree.Items v-slot="{ item }">
                <FileItem :item="item" :locked-id="lockedId" />
            </Tree.Items>
            <!-- where the drop lands: a line before or after a row, or the box of a folder -->
            <Tree.DropIndicator :class="styles.dropIndicator" />
            <Tree.LiveRegion :class="styles.liveRegion" />
        </Tree.Root>
        <span :id="lockedId" hidden>Locked</span>
        <p :class="styles.hint">
            Drag a row to reorder it or move it into a folder.
            <Lock aria-hidden="true" :class="styles.hintIcon" /> items stay in
            place; nothing can be dropped into vendor.
        </p>
    </div>
</template>
