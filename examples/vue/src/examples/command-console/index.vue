<script setup lang="ts">
import { type CommandResult, createTreeModel, veto } from "@fragiola/tree-vue";
import { Play } from "@lucide/vue";
import { onUnmounted, ref, useId } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { type FileTypes, fileSystem } from "../_kit/data";
import FileItem from "./file-item.vue";
import * as styles from "./styles";
import { features, Tree } from "./tree";

// An assistant, a script or a remote control drives the tree with the same JSON commands a key
// or a click runs: `model.get("commands")` describes each one (its JSON Schemas are ready to be
// tool definitions), and `model.dispatch` validates untrusted input before running it.

const PRESETS: readonly { name: string; input: unknown }[] = [
    { name: "Expand all", input: { command: "tree.expand-all", payload: {} } },
    {
        name: "Select README.md",
        input: { command: "item.select", payload: { itemId: "readme" } },
    },
    {
        name: "Rename app.tsx",
        input: {
            command: "item.rename",
            payload: { itemId: "app", label: "root.tsx" },
        },
    },
    {
        name: "Move README.md into src",
        input: {
            command: "item.move",
            payload: {
                itemIds: ["readme"],
                to: { parentItemId: "src", index: 0 },
            },
        },
    },
    {
        name: "Delete README.md",
        input: { command: "item.remove", payload: { itemIds: ["readme"] } },
    },
];

const format = (value: unknown) => JSON.stringify(value, null, 2);

type Outcome =
    | { status: "ok"; text: string }
    | { status: "error"; text: string }
    | undefined;

function outcomeOf(result: CommandResult<unknown>): Outcome {
    return result.ok
        ? { status: "ok", text: format(result.value) }
        : { status: "error", text: format(result.error) };
}

// the model is created once, outside Vue's reactivity
const model = createTreeModel<FileTypes, typeof features>(fileSystem(), {
    features,
});
const commands = model.get("commands");
const text = ref(format(PRESETS[0]?.input));
const outcome = ref<Outcome>();
const inputId = useId();

// the app's policy for what it did not type itself: `meta` comes from the app, never from the
// untrusted input, so a middleware can trust it
onUnmounted(
    model.use((ctx, next) =>
        ctx.meta?.source === "console" && ctx.command === "item.remove"
            ? veto("The console may not delete items.")
            : next(),
    ),
);

const run = (input: string) => {
    let parsed: unknown;
    try {
        parsed = JSON.parse(input);
    } catch (error) {
        outcome.value = {
            status: "error",
            text: `Invalid JSON: ${String(error)}`,
        };
        return;
    }
    outcome.value = outcomeOf(
        model.dispatch(parsed, { meta: { source: "console" } }),
    );
};

const runPreset = (preset: (typeof PRESETS)[number]) => {
    const input = format(preset.input);
    text.value = input;
    run(input);
};

const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        run(text.value);
    }
};
</script>

<template>
    <div :class="styles.frame">
        <Tree.Root :model="model" aria-label="Project files" :class="styles.root">
            <Tree.Items v-slot="{ item }">
                <FileItem :item="item" />
            </Tree.Items>
        </Tree.Root>
        <section aria-label="Command console" :class="styles.panel">
            <div :class="styles.presets">
                <Clickable.Button
                    v-for="preset in PRESETS"
                    :key="preset.name"
                    variant="outline"
                    size="sm"
                    :class="styles.preset"
                    @click="runPreset(preset)"
                >
                    {{ preset.name }}
                </Clickable.Button>
            </div>
            <label :for="inputId" :class="styles.inputLabel">
                Command (JSON)
            </label>
            <textarea
                :id="inputId"
                v-model="text"
                spellcheck="false"
                :class="styles.input"
                @keydown="onKeydown"
            />
            <div :class="styles.runRow">
                <span :class="styles.runHint">Ctrl/⌘ + Enter</span>
                <Clickable.Button
                    size="sm"
                    :class="styles.dispatch"
                    @click="run(text)"
                >
                    <Play aria-hidden="true" />
                    Dispatch
                </Clickable.Button>
            </div>
            <output
                aria-live="polite"
                data-testid="console-result"
                :data-status="outcome?.status"
                :class="styles.result(outcome?.status)"
            >
                {{ outcome ? outcome.text : "The result shows here." }}
            </output>
            <details :class="styles.commands">
                <summary :class="styles.commandsSummary">
                    {{ `Every command (${commands.length})` }}
                </summary>
                <dl :class="styles.commandList">
                    <div
                        v-for="command in commands"
                        :key="command.name"
                        :class="styles.command"
                    >
                        <dt :class="styles.commandName">{{ command.name }}</dt>
                        <dd :class="styles.commandDescription">
                            {{ command.description }}
                        </dd>
                    </div>
                </dl>
            </details>
        </section>
    </div>
</template>
