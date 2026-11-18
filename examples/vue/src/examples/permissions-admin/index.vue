<script setup lang="ts">
import { createTreeModel, useTreeState } from "@fragiola/tree-vue";
import { RotateCcw, Save, Search } from "@lucide/vue";
import { computed, onScopeDispose, ref, useId } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { features } from "./features";
import PermissionItem from "./permission-item.vue";
import {
    changesOf,
    expand,
    grantedActions,
    grantsOf,
    keyMap,
    lockRule,
    organization,
    type PermissionTypes,
    ROLE_NAMES,
    roleOf,
    search,
    toggle,
} from "./permissions";
import * as styles from "./styles";
import { Tree } from "./tree";

const json = organization();
// the model is created once, outside Vue's reactivity
const model = createTreeModel<PermissionTypes, typeof features>(json, {
    features,
});
onScopeDispose(lockRule(model));
// The checks are the app's state, as a form field's value is: the tree shows them and reports
// every change it would make; presets and Discard set them.
// (from the model's list: it has the cascade's parents, as every change will)
const checkedItemIds = ref<string[]>([...model.state.checkedItemIds]);
// what is saved: the granted actions at the last Save
const saved = ref(grantedActions(model, json.checkedItemIds ?? []));
const current = computed(() => grantedActions(model, checkedItemIds.value));
const changes = computed(() => changesOf(model, saved.value, current.value));
const role = computed(() => roleOf(current.value));
const query = ref("");
const found = useTreeState(
    (_state, currentModel) => search(currentModel, query.value),
    {
        model,
    },
);
// what the rules refused, or what was done
const notice = ref("");
const dialog = ref<HTMLDialogElement>();
const titleId = useId();

const run = (result: { ok: boolean; error?: { message: string } }) => {
    notice.value = result.ok ? "" : (result.error?.message ?? "");
};

function chooseRole(name: string) {
    if (name !== "Custom") checkedItemIds.value = grantsOf(name);
}

function onSearch(value: string) {
    query.value = value;
    // the folders around the matches open
    expand(model, search(model, value).aroundIds);
}

// Space is the app's: the tree's own would uncheck granted actions with their parent
function onKeydown(event: KeyboardEvent) {
    if (event.key !== " " || event.target instanceof HTMLInputElement) return;
    const { focusedItemId } = model.state;
    if (focusedItemId === null) return;
    event.preventDefault();
    run(toggle(model, focusedItemId));
}

function discard() {
    checkedItemIds.value = [...saved.value];
    notice.value = "Discarded.";
}

function save() {
    saved.value = current.value;
    notice.value = "Saved.";
    dialog.value?.close();
}

// granting a risky action asks first
function askToSave() {
    if (changes.value.risky.length > 0) dialog.value?.showModal();
    else save();
}
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <label :class="styles.field">
                <span :class="styles.fieldLabel">Role</span>
                <select
                    :value="role"
                    :class="styles.select"
                    @change="chooseRole(($event.target as HTMLSelectElement).value)"
                >
                    <option v-for="name in ROLE_NAMES" :key="name" :value="name">{{ name }}</option>
                    <option value="Custom" disabled>Custom</option>
                </select>
            </label>
            <span :class="styles.searchField">
                <Search aria-hidden="true" :class="styles.searchIcon" />
                <input
                    type="search"
                    aria-label="Search permissions"
                    placeholder="Search"
                    :value="query"
                    :class="styles.search"
                    @input="onSearch(($event.target as HTMLInputElement).value)"
                />
            </span>
            <span v-if="query.trim() !== ''" :class="styles.matches" data-testid="matches">
                {{ found.matchIds.size }} {{ found.matchIds.size === 1 ? "match" : "matches" }}
            </span>
        </div>
        <div :class="styles.body">
            <Tree.Root
                v-model:checked-item-ids="checkedItemIds"
                :model="model"
                :key-map="keyMap"
                aria-label="Permissions"
                :class="styles.root"
                @keydown="onKeydown"
            >
                <Tree.Items v-slot="{ item }">
                    <PermissionItem
                        :item="item"
                        :model="model"
                        :saved="saved"
                        :found="found"
                        @toggle="(itemId) => run(toggle(model, itemId))"
                    />
                </Tree.Items>
            </Tree.Root>
            <section aria-label="Changes" :class="styles.summary">
                <h2 :class="styles.summaryTitle">Changes</h2>
                <p :class="styles.summaryText" data-testid="changes">
                    {{
                        changes.added.length === 0 && changes.removed.length === 0
                            ? "No changes"
                            : `${changes.added.length} added, ${changes.removed.length} removed`
                    }}
                </p>
                <ul :class="styles.areas">
                    <li v-for="area in changes.byArea" :key="area.area" :class="styles.area">
                        <span>{{ area.area }}</span>
                        <span :class="styles.counts">
                            <span v-if="area.added > 0" :class="styles.added">+{{ area.added }}</span>
                            <span v-if="area.removed > 0" :class="styles.removed">−{{ area.removed }}</span>
                        </span>
                    </li>
                </ul>
                <div :class="styles.actions">
                    <Clickable.Button
                        variant="outline"
                        size="sm"
                        :disabled="changes.added.length + changes.removed.length === 0"
                        @click="discard"
                    >
                        <RotateCcw aria-hidden="true" />
                        Discard
                    </Clickable.Button>
                    <Clickable.Button
                        variant="outline"
                        size="sm"
                        :disabled="changes.added.length + changes.removed.length === 0"
                        @click="askToSave"
                    >
                        <Save aria-hidden="true" />
                        Save
                    </Clickable.Button>
                </div>
                <p role="status" data-testid="notice" :class="styles.notice">{{ notice }}</p>
            </section>
        </div>
        <dialog ref="dialog" :aria-labelledby="titleId" :class="styles.dialog">
            <h2 :id="titleId" :class="styles.dialogTitle">Grant risky permissions?</h2>
            <ul :class="styles.riskyList">
                <li v-for="change in changes.risky" :key="change.id">{{ change.area }} · {{ change.name }}</li>
            </ul>
            <div :class="styles.actions">
                <Clickable.Button variant="outline" size="sm" @click="dialog?.close()">Cancel</Clickable.Button>
                <Clickable.Button size="sm" :class="styles.danger" @click="save">Grant and save</Clickable.Button>
            </div>
        </dialog>
    </div>
</template>
