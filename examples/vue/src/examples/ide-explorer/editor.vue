<script setup lang="ts">
import { useTreeState } from "@fragiola/tree-vue";
import { ChevronRight, X } from "@lucide/vue";
import { computed, onScopeDispose, shallowRef } from "vue";
import FileIcon from "./file-icon.vue";
import { ancestorIds, CONTENTS } from "./project";
import * as styles from "./styles";
import type { EditorsStore, ProjectModel } from "./workspace";

const props = defineProps<{ model: ProjectModel; editors: EditorsStore }>();

/** The editor area: a tab per open file, the active file's path and its text. */
const editors = shallowRef(props.editors.get());
onScopeDispose(
    props.editors.subscribe(() => {
        editors.value = props.editors.get();
    }),
);

// the labels and the path come from the model: a rename or a move shows here at once
const files = useTreeState(
    (_state, current) =>
        editors.value.openFileIds.flatMap(
            (id) => current.get("item-by", { id }) ?? [],
        ),
    { model: props.model },
);
const path = useTreeState(
    (_state, current) => {
        const { activeFileId } = editors.value;
        return activeFileId === null
            ? []
            : [...ancestorIds(current, activeFileId), activeFileId].map(
                  (id) => ({
                      id,
                      label: current.get("item-by", { id })?.label ?? id,
                  }),
              );
    },
    { model: props.model },
);
const text = computed(() => {
    const { activeFileId } = editors.value;
    return activeFileId === null ? undefined : (CONTENTS[activeFileId] ?? "");
});
/** The file's text, read-only, with line numbers (an app mounts its editor here). */
const lines = computed(() => (text.value ? text.value.split("\n") : [""]));
</script>

<template>
    <section aria-label="Editor" :class="styles.editor">
        <div role="tablist" aria-label="Open editors" :class="styles.tabList">
            <div
                v-for="file in files"
                :key="file.id"
                :data-active="file.id === editors.activeFileId ? '' : undefined"
                :class="styles.tab"
            >
                <button
                    type="button"
                    role="tab"
                    :aria-selected="file.id === editors.activeFileId"
                    :class="styles.tabButton"
                    @click="props.editors.activate(file.id)"
                >
                    <FileIcon :item="file" :model="model" />
                    {{ file.label }}
                </button>
                <button
                    type="button"
                    :aria-label="`Close ${file.label}`"
                    :class="styles.tabClose"
                    @click="props.editors.close(file.id)"
                >
                    <X aria-hidden="true" />
                </button>
            </div>
        </div>
        <p v-if="text === undefined" :class="styles.empty">
            Select a file in the explorer to open it.
        </p>
        <template v-else>
            <nav aria-label="Path" :class="styles.breadcrumb">
                <span v-for="(crumb, index) in path" :key="crumb.id" :class="styles.crumb">
                    <ChevronRight v-if="index > 0" aria-hidden="true" />
                    {{ crumb.label }}
                </span>
            </nav>
            <pre data-testid="code" :class="styles.code"><span
                v-for="(line, index) in lines"
                :key="index"
                :class="styles.line"
            ><span aria-hidden="true" :class="styles.lineNumber">{{ index + 1 }}</span><span>{{ line }}</span></span></pre>
        </template>
    </section>
</template>
