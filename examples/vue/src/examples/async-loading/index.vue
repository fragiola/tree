<script setup lang="ts">
import {
    type AnnounceEvent,
    createTreeModel,
    type TreeJson,
} from "@fragiola/tree-vue";
import { type SelectionFeature, selection } from "@fragiola/tree-vue/selection";
import type { FileTypes } from "../_kit/data";
import { createFakeLoader } from "../_kit/loader";
import DriveItem from "./drive-item.vue";
import * as styles from "./styles";
import { Tree } from "./tree";

// Only the root folders are in the document: `childrenStatus: "unloaded"` says their children come
// from the app's `loadChildren`, called the first time each one is expanded.
const json: TreeJson<FileTypes> = {
    version: 1,
    rootItemIds: ["photos", "documents", "archive"],
    items: {
        photos: { kind: "folder", label: "Photos", childrenStatus: "unloaded" },
        documents: {
            kind: "folder",
            label: "Documents",
            childrenStatus: "unloaded",
        },
        archive: {
            kind: "folder",
            label: "Archive",
            childrenStatus: "unloaded",
        },
    },
};

const model = createTreeModel<FileTypes, readonly [SelectionFeature]>(json, {
    features: [selection()],
});
// an app's loader fetches from its back-end; this fake answers after 500 ms, and fails the
// first load of "documents"
const loadChildren = createFakeLoader({
    latency: 500,
    failOnce: ["documents"],
});
// the live region's text: the package writes none. Here, only a failed load is announced
const announce = (event: AnnounceEvent) => {
    if (event.type !== "load-error") return undefined;
    const label = model.get("item-by", { id: event.itemId })?.label;
    return `Could not load ${label}. Use Retry to try again.`;
};
</script>

<template>
    <div :class="styles.frame">
        <p :class="styles.hint">
            Open a folder: its contents come from the server. The first load
            of Documents fails.
        </p>
        <Tree.Root
            :model="model"
            :load-children="loadChildren"
            :announce="announce"
            expand-on-click
            aria-label="Cloud drive"
            :class="styles.root"
        >
            <Tree.Items v-slot="{ item }">
                <DriveItem :item="item" />
            </Tree.Items>
            <Tree.LiveRegion :class="styles.liveRegion" />
        </Tree.Root>
    </div>
</template>
