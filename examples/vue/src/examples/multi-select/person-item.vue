<script setup lang="ts">
import type { ItemOf } from "@fragiola/tree-vue";
import { ChevronRight, UserRound } from "@lucide/vue";
import { useId } from "vue";
import type { OrgTypes } from "../_kit/data";
import * as styles from "./styles";
import { Tree } from "./tree";

defineProps<{ item: ItemOf<OrgTypes> }>();

// the role describes the person; the name alone is the item's accessible name
const roleId = useId();
</script>

<template>
    <Tree.Item :item="item" :aria-describedby="roleId" :class="styles.item">
        <Tree.ItemContent :class="styles.row">
            <Tree.Toggle :class="styles.toggle">
                <ChevronRight aria-hidden="true" />
            </Tree.Toggle>
            <UserRound aria-hidden="true" :class="styles.icon" />
            <span :class="styles.label">{{ item.label }}</span>
            <span :id="roleId" aria-hidden="true" :class="styles.role">
                {{ item.data.role }}
            </span>
        </Tree.ItemContent>
        <Tree.Group v-slot="{ item: child }">
            <PersonItem :item="child" />
        </Tree.Group>
    </Tree.Item>
</template>
