<script setup lang="ts">
import { type ItemOf, useTreeState } from "@fragiola/tree-vue";
import { ArrowRightLeft } from "@lucide/vue";
import { ref, useId } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import type { WarehouseModel } from "./features";
import * as styles from "./styles";
import { binsFor, type WarehouseTypes } from "./warehouse";

const props = defineProps<{
    model: WarehouseModel;
    item: Extract<ItemOf<WarehouseTypes>, { kind: "product" }>;
}>();

/** A product's quantity and its place: both go through commands, so the storage rules decide. */
const quantityId = useId();
const binId = useId();
const quantity = ref(String(props.item.data.quantity));
const target = ref("");
// what the rules refused, or what was done
const notice = ref("");
// the bins the rules accept for it, asked of the model (`model.can`) once per state
const bins = useTreeState(
    (_state, current) => binsFor(current, props.item.id),
    {
        model: props.model,
        isEqual: (a, b) =>
            a.map((bin) => bin.id).join() === b.map((bin) => bin.id).join(),
    },
);

function updateQuantity() {
    const result = props.model.run("item.set-data", {
        itemId: props.item.id,
        data: { ...props.item.data, quantity: Number(quantity.value) },
    });
    notice.value = result.ok ? "Quantity updated." : result.error.message;
}

function move() {
    if (target.value === "") return;
    const result = props.model.run("item.move", {
        itemIds: [props.item.id],
        // last in the bin
        to: {
            parentItemId: target.value,
            index: props.model.get("child-items-by", { itemId: target.value })
                .length,
        },
    });
    notice.value = result.ok ? "Moved." : result.error.message;
    target.value = "";
}
</script>

<template>
    <form :class="styles.form" @submit.prevent="updateQuantity">
        <label :for="quantityId" :class="styles.term">Quantity</label>
        <div :class="styles.formRow">
            <input
                :id="quantityId"
                v-model="quantity"
                type="number"
                min="0"
                step="1"
                :class="styles.input"
            />
            <Clickable.Button type="submit" variant="outline" size="sm">Update</Clickable.Button>
        </div>
    </form>
    <form :class="styles.form" @submit.prevent="move">
        <label :for="binId" :class="styles.term">Move to</label>
        <div :class="styles.formRow">
            <select :id="binId" v-model="target" :class="styles.select">
                <option value="">Choose a bin…</option>
                <option v-for="bin in bins" :key="bin.id" :value="bin.id">{{ bin.label }}</option>
            </select>
            <Clickable.Button type="submit" variant="outline" size="sm" :disabled="target === ''">
                <ArrowRightLeft aria-hidden="true" />
                Move
            </Clickable.Button>
        </div>
    </form>
    <p role="status" data-testid="details-notice" :class="styles.notice">{{ notice }}</p>
</template>
