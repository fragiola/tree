<script setup lang="ts">
import { ref, useId } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { Switch } from "#/components/ui/switch";
import { fileSystem } from "../_kit/data";
import FileItem from "./file-item.vue";
import * as styles from "./styles";
import { Tree } from "./tree";

const json = fileSystem();
/** Every folder: what "Expand all" opens. */
const FOLDER_IDS = Object.entries(json.items).flatMap(([id, item]) =>
    item.kind === "folder" ? [id] : [],
);
const labelOf = (itemId: string) => json.items[itemId]?.label ?? itemId;

// The app's own state. The tree shows it, and reports every change it would make (a click, a
// key) through its `update:*` events: the app decides what the state becomes.
const expandedItemIds = ref<string[]>(["src"]);
const selectedItemIds = ref<string[]>([]);
const keepSrcOpen = ref(false);
const switchId = useId();

const changeExpanded = (itemIds: string[]) => {
    // a change the app refuses is reverted: here, "src" can be kept open
    expandedItemIds.value =
        keepSrcOpen.value && !itemIds.includes("src")
            ? ["src", ...itemIds]
            : itemIds;
};

const changeKeepSrcOpen = (checked: boolean) => {
    keepSrcOpen.value = checked;
    if (checked && !expandedItemIds.value.includes("src")) {
        expandedItemIds.value = ["src", ...expandedItemIds.value];
    }
};
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <Clickable.Button
                variant="outline"
                size="sm"
                @click="expandedItemIds = FOLDER_IDS"
            >
                Expand all
            </Clickable.Button>
            <Clickable.Button
                variant="outline"
                size="sm"
                @click="changeExpanded([])"
            >
                Collapse all
            </Clickable.Button>
            <Clickable.Button
                variant="outline"
                size="sm"
                @click="selectedItemIds = ['readme']"
            >
                Select README.md
            </Clickable.Button>
            <Clickable.Button
                variant="outline"
                size="sm"
                :disabled="selectedItemIds.length === 0"
                @click="selectedItemIds = []"
            >
                Clear selection
            </Clickable.Button>
            <span :class="styles.switchField">
                <Switch.Root
                    :aria-labelledby="switchId"
                    :model-value="keepSrcOpen"
                    @update:model-value="changeKeepSrcOpen"
                >
                    <Switch.Thumb />
                </Switch.Root>
                <span :id="switchId">Keep src open</span>
            </span>
        </div>
        <div :class="styles.body">
            <!-- v-model:selected-item-ids binds the selection both ways; the expansion goes through
                 the app's own rule -->
            <Tree.Root
                :default-tree="json"
                :expanded-item-ids="expandedItemIds"
                @update:expanded-item-ids="changeExpanded"
                v-model:selected-item-ids="selectedItemIds"
                aria-label="Project files"
                :class="styles.root"
            >
                <Tree.Items v-slot="{ item }">
                    <FileItem :item="item" />
                </Tree.Items>
            </Tree.Root>
            <section aria-label="App state" :class="styles.state">
                <h2 :class="styles.stateTitle">expandedItemIds</h2>
                <output data-testid="expanded-state" :class="styles.stateValue">{{
                    JSON.stringify(expandedItemIds)
                }}</output>
                <h2 :class="styles.stateTitle">selectedItemIds</h2>
                <output data-testid="selected-state" :class="styles.stateValue">{{
                    JSON.stringify(selectedItemIds)
                }}</output>
                <p :class="styles.stateNote">
                    {{
                        selectedItemIds.length === 0
                            ? "Nothing selected."
                            : `Selected: ${selectedItemIds.map(labelOf).join(", ")}`
                    }}
                </p>
            </section>
        </div>
    </div>
</template>
