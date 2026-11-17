<script setup lang="ts">
import { createTreeModel, type TreeJson } from "@fragiola/tree-vue";
import { computed, ref, useId } from "vue";
import { Switch } from "#/components/ui/switch";
import List from "./list.vue";
import * as styles from "./styles";
import type { Types } from "./tree";

// Two trees in one drag group (`drag-group`): items drag between them with the pointer, or with the
// keyboard (Ctrl+Shift+D, then Down past the last place of one list reaches the other). Over two
// models a drop is a transfer: the target model adds the dragged subtrees (`item.add`), the source
// model removes them (`item.remove`), each through its own middleware. Over one shared model it is
// one `item.move`.
const available: TreeJson<Types> = {
    version: 1,
    rootItemIds: ["fruit", "vegetables", "herbs"],
    items: {
        fruit: {
            kind: "group",
            label: "Fruit",
            childItemIds: ["apple", "banana", "cherry"],
        },
        apple: { kind: "produce", label: "Apple" },
        banana: { kind: "produce", label: "Banana" },
        cherry: { kind: "produce", label: "Cherry" },
        vegetables: {
            kind: "group",
            label: "Vegetables",
            childItemIds: ["carrot", "leek"],
        },
        carrot: { kind: "produce", label: "Carrot" },
        leek: { kind: "produce", label: "Leek" },
        herbs: {
            kind: "group",
            label: "Herbs",
            childItemIds: ["basil", "mint"],
        },
        basil: { kind: "produce", label: "Basil" },
        mint: { kind: "produce", label: "Mint" },
    },
    expandedItemIds: ["fruit", "vegetables", "herbs"],
};

const selected: TreeJson<Types> = { version: 1, rootItemIds: [], items: {} };

// separate models (a transfer between them), or one model both trees show (a move); created
// once (never in a ref)
const models = {
    available: createTreeModel<Types>(available),
    selected: createTreeModel<Types>(selected),
    shared: createTreeModel<Types>(available),
};
const shared = ref(false);
const switchId = useId();
const left = computed(() => (shared.value ? models.shared : models.available));
const right = computed(() => (shared.value ? models.shared : models.selected));
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <span :class="styles.switchField">
                <Switch.Root
                    :aria-labelledby="switchId"
                    v-model="shared"
                >
                    <Switch.Thumb />
                </Switch.Root>
                <span :id="switchId">One shared model</span>
            </span>
        </div>
        <div :class="styles.lists">
            <List :key="`available-${shared}`" :model="left" name="Available" />
            <List :key="`selected-${shared}`" :model="right" name="Selected" />
        </div>
        <p :class="styles.hint">
            Drag items from one list to the other, or press Ctrl+Shift+D on
            one and Down past the last place of its list.
        </p>
    </div>
</template>
