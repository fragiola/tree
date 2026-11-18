<script setup lang="ts">
import { type ItemOf, useTreeItem, useTreeState } from "@fragiola/tree-vue";
import { Check, ChevronRight, Lock, Minus, TriangleAlert } from "@lucide/vue";
import { computed, useId } from "vue";
import type { PermissionModel } from "./features";
import KindIcon from "./kind-icon.vue";
import {
    describe,
    isRisky,
    type PermissionTypes,
    type search,
} from "./permissions";
import * as styles from "./styles";
import { Tree } from "./tree";

const props = defineProps<{
    item: ItemOf<PermissionTypes>;
    model: PermissionModel;
    saved: readonly string[];
    found: ReturnType<typeof search>;
}>();
const emit = defineEmits<{ toggle: [itemId: string] }>();

/** A row: the check, the icon, the name, then a lock, a risk mark and the change since the save. */
const { state } = useTreeItem(() => props.item);
const descriptionId = useId();
const checkedIds = useTreeState((current) => new Set(current.checkedItemIds), {
    model: props.model,
});
const change = computed(() => {
    if (props.item.kind !== "action") return undefined;
    const savedNow = props.saved.includes(props.item.id);
    if (savedNow === state.value.checked) return undefined;
    return state.value.checked ? "added" : "removed";
});
const description = computed(() =>
    [
        describe(props.model, props.item, checkedIds.value),
        change.value === "added"
            ? "Added"
            : change.value === "removed"
              ? "Removed"
              : "",
    ]
        .filter(Boolean)
        .join(", "),
);
const dimmed = computed(
    () =>
        props.found.matchIds.size > 0 &&
        !props.found.matchIds.has(props.item.id) &&
        !props.found.aroundIds.has(props.item.id),
);
const onCheck = () => {
    if (!state.value.disabled) emit("toggle", props.item.id);
};
</script>

<template>
    <!-- the search's highlight is the app's: data attributes its styles read -->
    <Tree.Item
        :item="item"
        :aria-describedby="descriptionId"
        :data-match="found.matchIds.has(item.id) ? '' : undefined"
        :data-dimmed="dimmed ? '' : undefined"
        :class="styles.item"
    >
        <Tree.ItemContent :class="styles.row">
            <Tree.Toggle :class="styles.toggle">
                <ChevronRight aria-hidden="true" />
            </Tree.Toggle>
            <!-- the app's own check control: the item carries aria-checked; Space is the app's too
                 (keydown on the root); it toggles the actions that are not granted -->
            <span
                aria-hidden="true"
                data-tree-no-drag=""
                data-testid="check"
                :data-checked="state.checked ? '' : undefined"
                :data-indeterminate="state.indeterminate ? '' : undefined"
                :data-disabled="state.disabled ? '' : undefined"
                :class="styles.checkbox"
                @click="onCheck"
            >
                <Check aria-hidden="true" :class="styles.checkIcon" />
                <Minus aria-hidden="true" :class="styles.mixedIcon" />
            </span>
            <KindIcon :item="item" />
            <span :class="styles.label">{{ item.label }}</span>
            <span :id="descriptionId" hidden>{{ description }}</span>
            <Lock v-if="item.kind === 'action' && item.data.grantedBy" aria-hidden="true" :class="styles.lock" />
            <TriangleAlert v-if="isRisky(item)" aria-hidden="true" :class="styles.risk" />
            <span v-if="change" aria-hidden="true" data-testid="change" :class="styles.change[change]">
                {{ change === "added" ? "+" : "−" }}
            </span>
        </Tree.ItemContent>
        <Tree.Group v-slot="{ item: child }">
            <PermissionItem
                :item="child"
                :model="model"
                :saved="saved"
                :found="found"
                @toggle="(itemId) => emit('toggle', itemId)"
            />
        </Tree.Group>
    </Tree.Item>
</template>
