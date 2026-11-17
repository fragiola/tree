// The whole tree: `tree.configure` (its settings), `tree.load` (a new document) and `batch` (several
// commands as one atomic step).
import { requiresFeature } from "../features/registry";
import type { FeatureState } from "../features/types";
import { idListSchema, settingsProperties, treeSchema } from "../schema/tree";
import { normalizeChecks } from "../state/check-state";
import type { StateField } from "../state/draft";
import type { TreeSettings, TreeState } from "../state/types";
import { defineCommand, fail, ok } from "./define";

const settingsResultSchema = {
    type: "object",
    properties: {
        selectionMode: {
            ...settingsProperties.selectionMode,
            description: "how many items can be selected (`selection()`)",
        },
        checkMode: {
            ...settingsProperties.checkMode,
            description: "how checkboxes relate",
        },
        movable: { type: "boolean", description: "the default of movable" },
        renamable: { type: "boolean", description: "the default of renamable" },
        droppable: { type: "boolean", description: "the default of droppable" },
    },
    required: ["checkMode", "movable", "renamable", "droppable"],
    additionalProperties: false,
} as const;

export const treeConfigure = defineCommand({
    name: "tree.configure",
    description:
        "Change the tree's settings: the selection mode (none, single, multiple; a narrower mode trims the selection; with the selection feature), the check mode (cascade or independent; switching to cascade makes the checks consistent) and the defaults of the movable, renamable and droppable flags.",
    payloadSchema: {
        type: "object",
        properties: {
            settings: {
                type: "object",
                properties: settingsProperties,
                additionalProperties: false,
                description: "the settings to change (the others are kept)",
            },
        },
        required: ["settings"],
        additionalProperties: false,
    },
    resultSchema: {
        type: "object",
        properties: {
            settings: {
                ...settingsResultSchema,
                description: "the settings after the command",
            },
        },
        required: ["settings"],
        additionalProperties: false,
    },
    transient: false,
    reduce: (payload, { draft }) => {
        for (const key of Object.keys(payload.settings)) {
            const owner = draft.features.missing("settings", key);
            if (owner !== undefined)
                return fail(
                    "invalid_payload",
                    requiresFeature(owner),
                    `/settings/${key}`,
                );
        }
        const before = draft.settings;
        const settings: TreeSettings = { ...before, ...payload.settings };
        const changed = (Object.keys(settings) as (keyof TreeSettings)[]).some(
            (key) => settings[key] !== before[key],
        );
        if (changed) draft.set("settings", settings);
        draft.features.configured(draft, before as FeatureState["settings"]);
        if (
            settings.checkMode === "cascade" &&
            before.checkMode !== "cascade"
        ) {
            normalizeChecks(draft);
        }
        if (
            settings.renamable === false &&
            draft.state.renamingItemId !== null
        ) {
            const item = draft.item(draft.state.renamingItemId);
            if (item?.renamable === undefined)
                draft.set("renamingItemId", null);
        }
        return ok({ settings: { ...draft.settings } });
    },
});

/** The fields of a state a load replaces, besides the items (and the installed features'). */
const FIELDS: readonly StateField[] = [
    "settings",
    "rootItemIds",
    "expandedItemIds",
    "checkedItemIds",
    "focusedItemId",
    "renamingItemId",
];

export const treeLoad = defineCommand({
    name: "tree.load",
    description:
        'Replace the whole tree with a document (version 1, the same JSON `model.get("tree-json")` writes). The document is validated first; every problem is reported with its path. An item that keeps its id keeps its identity when nothing about it changed.',
    payloadSchema: {
        type: "object",
        properties: {
            json: { ...treeSchema, description: "the tree document" },
        },
        required: ["json"],
        additionalProperties: false,
    },
    resultSchema: {
        type: "object",
        properties: {
            itemIds: {
                ...idListSchema,
                description: "every item of the new tree",
            },
        },
        required: ["itemIds"],
        additionalProperties: false,
    },
    transient: false,
    reduce: (payload, context) => {
        const { draft } = context;
        const built = context.loadTree(payload.json, "/json");
        if (!built.ok) return built;
        const next: TreeState = built.state;
        for (const id of Object.keys(draft.state.items)) {
            if (!Object.hasOwn(next.items, id)) draft.deleteItem(id);
        }
        for (const [id, item] of Object.entries(next.items)) {
            const current = draft.item(id);
            if (!current || JSON.stringify(current) !== JSON.stringify(item)) {
                draft.setItem(item);
            }
        }
        for (const field of FIELDS) {
            const value = next[field];
            const current = draft.state[field];
            if (JSON.stringify(current) !== JSON.stringify(value)) {
                draft.set(field, value as never);
            }
        }
        for (const field of draft.features.fields) {
            const value = (next as unknown as Record<string, unknown>)[field];
            if (JSON.stringify(draft.field(field)) !== JSON.stringify(value)) {
                draft.setField(field, value);
            }
        }
        return ok({ itemIds: Object.keys(next.items) });
    },
});

export const batch = defineCommand({
    name: "batch",
    description:
        "Run several commands as one step: they apply in order, each seeing the result of the ones before it, and either all of them apply (one event, one undo step) or none does (the first failure is returned, at its path in `commands`).",
    payloadSchema: {
        type: "object",
        properties: {
            commands: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        command: {
                            type: "string",
                            description: "the command's name",
                        },
                        payload: {
                            type: "object",
                            description: "its payload",
                        },
                    },
                    required: ["command", "payload"],
                    additionalProperties: false,
                },
                description: "the commands, in order",
            },
        },
        required: ["commands"],
        additionalProperties: false,
    },
    resultSchema: {
        type: "object",
        properties: {
            results: {
                type: "array",
                items: { description: "a command's value" },
                description: "each command's value, in order",
            },
        },
        required: ["results"],
        additionalProperties: false,
    },
    transient: true,
    reduce: (payload, context) => {
        const results: unknown[] = [];
        for (const [i, entry] of payload.commands.entries()) {
            if (entry.command === "batch") {
                return fail(
                    "refused",
                    "a batch cannot hold a batch",
                    `/commands/${i}/command`,
                );
            }
            const result = context.runInBatch(
                entry.command,
                entry.payload,
                `/commands/${i}`,
            );
            if (!result.ok) return result;
            results.push(result.value);
        }
        return ok({ results });
    },
});
