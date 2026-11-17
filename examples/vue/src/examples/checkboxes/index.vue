<script setup lang="ts">
import { createTreeModel, useTreeState } from "@fragiola/tree-vue";
import { type PermissionTypes, permissions } from "../_kit/data";
import PermissionItem from "./permission-item.vue";
import * as styles from "./styles";
import { Tree } from "./tree";

// The kit's permissions are checked in cascade (`settings.checkMode: "cascade"`): checking a group
// checks its permissions, and a group with only some of them checked is mixed. `checkboxes` puts
// `aria-checked` on every item, and makes Space toggle the focused item's check.

const model = createTreeModel<PermissionTypes>(permissions());
// the scopes the app would save: the checked permissions (a group is only a shortcut)
const scopes = useTreeState<PermissionTypes, string>(
    (state) =>
        state.checkedItemIds
            .flatMap((itemId) => {
                const item = state.items[itemId];
                return item?.kind === "permission" ? [item.data.scope] : [];
            })
            .join(" "),
    { model },
);
</script>

<template>
    <div :class="styles.frame">
        <Tree.Root
            :model="model"
            checkboxes
            aria-label="Permissions"
            :class="styles.root"
        >
            <Tree.Items v-slot="{ item }">
                <PermissionItem :item="item" />
            </Tree.Items>
        </Tree.Root>
        <section aria-label="Granted scopes" :class="styles.readout">
            <h2 :class="styles.readoutTitle">Granted scopes</h2>
            <ul data-testid="scopes" :class="styles.scopes">
                <li v-if="scopes === ''" :class="styles.empty">None</li>
                <li
                    v-for="scope in scopes.split(' ')"
                    v-else
                    :key="scope"
                    :class="styles.scope"
                >
                    {{ scope }}
                </li>
            </ul>
        </section>
    </div>
</template>
