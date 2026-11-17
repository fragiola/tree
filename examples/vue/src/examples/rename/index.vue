<script setup lang="ts">
import { createTreeModel } from "@fragiola/tree-vue";
import { type SelectionFeature, selection } from "@fragiola/tree-vue/selection";
import { onScopeDispose, ref, useId } from "vue";
import { type FileTypes, fileSystem } from "../_kit/data";
import FileItem from "./file-item.vue";
import { namingRules } from "./naming-rules";
import * as styles from "./styles";
import { Tree } from "./tree";

const model = createTreeModel<FileTypes, readonly [SelectionFeature]>(
    fileSystem(),
    { features: [selection()] },
);
// the reason the last rename was refused, until the label changes or the rename ends
const error = ref<string>();
const errorId = useId();
onScopeDispose(namingRules(model));
onScopeDispose(
    model.subscribe((event) => {
        if (event.after.renamingItemId === null) error.value = undefined;
    }),
);
</script>

<template>
    <div :class="styles.frame">
        <p :class="styles.hint">
            Press <kbd :class="styles.kbd">F2</kbd> or double-click a row
            to rename it; <kbd :class="styles.kbd">Enter</kbd> saves,
            <kbd :class="styles.kbd">Esc</kbd> cancels.
        </p>
        <Tree.Root :model="model" aria-label="Project files" :class="styles.root">
            <Tree.Items v-slot="{ item }">
                <FileItem
                    :item="item"
                    :error-id="errorId"
                    @error="(refused) => (error = refused.message)"
                    @edit="error = undefined"
                />
            </Tree.Items>
        </Tree.Root>
        <p :id="errorId" role="alert" :class="styles.error">{{ error }}</p>
    </div>
</template>
