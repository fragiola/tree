<script setup lang="ts">
import { createTreeModel, useTreeState } from "@fragiola/tree-vue";
import { computed } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { type OrgTypes, orgChart } from "../_kit/data";
import PersonItem from "./person-item.vue";
import * as styles from "./styles";
import { features, Tree } from "./tree";

// The kit's organization chart has `settings.selectionMode: "multiple"`: a click selects one
// person, Ctrl/⌘ + click adds or removes one, Shift + click selects the range from the last one.

// the app owns the model (created once, never in a ref), so the summary outside the root can read it
const model = createTreeModel<OrgTypes, typeof features>(orgChart(), {
    features,
});
// the selected ids keep their identity until the selection changes: no extra render
const selectedItemIds = useTreeState<
    OrgTypes,
    readonly string[],
    typeof features
>((state) => state.selectedItemIds, { model });
const names = computed(() =>
    selectedItemIds.value.map(
        (itemId) => model.get("item-by", { id: itemId })?.label ?? itemId,
    ),
);
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <p role="status" data-testid="selection-count" :class="styles.count">
                {{
                    names.length === 0
                        ? "Nobody selected"
                        : `${names.length} selected`
                }}
            </p>
            <Clickable.Button
                variant="outline"
                size="sm"
                @click="model.run('tree.select-all', {})"
            >
                Select all
            </Clickable.Button>
            <Clickable.Button
                variant="outline"
                size="sm"
                :disabled="names.length === 0"
                @click="model.run('tree.clear-selection', {})"
            >
                Clear selection
            </Clickable.Button>
        </div>
        <Tree.Root :model="model" aria-label="Organization" :class="styles.root">
            <Tree.Items v-slot="{ item }">
                <PersonItem :item="item" />
            </Tree.Items>
        </Tree.Root>
        <p data-testid="selection-names" :class="styles.names">
            {{
                names.length === 0
                    ? "Ctrl/⌘ + click adds a person, Shift + click selects a range."
                    : names.join(", ")
            }}
        </p>
    </div>
</template>
