// Loading a document: its JSON Schema, then the rules a schema cannot say (references, one parent
// per item, no cycle, the selection mode), then the normalized state.
import { treeSchema } from "../schema/tree";
import type { JsonSchema, ValidationIssue } from "../schema/types";
import { joinPointer, validate } from "../schema/validator";
import { normalizeChecks } from "./check-state";
import { Draft, deepFreeze } from "./draft";
import { IdSource } from "./ids";
import { cloneJson } from "./json";
import { isLeaf, nearestVisible } from "./structure";
import {
    DEFAULT_SETTINGS,
    type TreeItem,
    type TreeSettings,
    type TreeState,
} from "./types";

/** A JSON Schema per item kind: the `data` of an item of that kind is validated against it. */
export type DataSchemas = { readonly [kind: string]: JsonSchema | undefined };

/** Thrown by `createTreeModel` for an invalid document: every problem, each with its JSON path. */
export class TreeValidationError extends Error {
    readonly issues: readonly ValidationIssue[];

    constructor(issues: readonly ValidationIssue[]) {
        const [first] = issues;
        super(
            first
                ? `Invalid tree document: ${first.path || "/"} ${first.message}${issues.length > 1 ? ` (and ${issues.length - 1} more)` : ""}`
                : "Invalid tree document",
        );
        this.name = "TreeValidationError";
        this.issues = issues;
    }
}

export type BuiltState =
    | { readonly ok: true; readonly state: TreeState }
    | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

/** The data issues of one item, when its kind has a schema. */
export function dataIssues(
    dataSchemas: DataSchemas | undefined,
    kind: string,
    data: unknown,
    path: string,
): ValidationIssue[] {
    const schema = dataSchemas?.[kind];
    return schema ? validate(schema, data, path) : [];
}

/** The rules of a document past its schema (the document is known to match it). */
function structureIssues(
    json: DocumentInput,
    prefix: string,
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const at = (path: string) => `${prefix}${path}`;
    const items = json.items;
    const has = (id: string) => Object.hasOwn(items, id);
    const parentOf = new Map<string, string>();

    const claim = (id: string, owner: string, path: string) => {
        if (!has(id)) {
            issues.push({ path: at(path), message: `"${id}" is not an item` });
            return;
        }
        const previous = parentOf.get(id);
        if (previous !== undefined) {
            issues.push({
                path: at(path),
                message: `"${id}" is already a child of ${previous}`,
            });
            return;
        }
        parentOf.set(id, owner);
    };
    json.rootItemIds.forEach((id, i) => {
        claim(id, "the root", `/rootItemIds/${i}`);
    });
    for (const [key, item] of Object.entries(items)) {
        const path = joinPointer("/items", key);
        if (item.id !== undefined && item.id !== key) {
            issues.push({
                path: at(`${path}/id`),
                message: `must be "${key}", the item's key`,
            });
        }
        if (
            item.childItemIds !== undefined &&
            item.childItemIds.length > 0 &&
            item.childrenStatus !== undefined &&
            item.childrenStatus !== "loaded"
        ) {
            issues.push({
                path: at(`${path}/childItemIds`),
                message: `must be empty while the children are ${item.childrenStatus}`,
            });
        }
        item.childItemIds?.forEach((id, i) => {
            claim(id, `"${key}"`, `${path}/childItemIds/${i}`);
        });
    }
    // every item reachable from the root, once: no orphan and no cycle
    const reached = new Set<string>();
    const visit = (ids: readonly string[]) => {
        for (const id of ids) {
            if (reached.has(id) || !has(id)) continue;
            reached.add(id);
            visit(items[id]?.childItemIds ?? []);
        }
    };
    visit(json.rootItemIds);
    for (const key of Object.keys(items)) {
        if (!reached.has(key)) {
            issues.push({
                path: at(joinPointer("/items", key)),
                message: parentOf.has(key)
                    ? "is inside a cycle: it is not reachable from the root"
                    : "is not in the tree: no parent and not a root item",
            });
        }
    }
    const lists = [
        "expandedItemIds",
        "selectedItemIds",
        "checkedItemIds",
    ] as const;
    for (const list of lists) {
        json[list]?.forEach((id, i) => {
            if (!has(id)) {
                issues.push({
                    path: at(`/${list}/${i}`),
                    message: `"${id}" is not an item`,
                });
            }
        });
    }
    const singles = [
        "selectionAnchorItemId",
        "focusedItemId",
        "renamingItemId",
    ] as const;
    for (const single of singles) {
        const id = json[single];
        if (typeof id === "string" && !has(id)) {
            issues.push({
                path: at(`/${single}`),
                message: `"${id}" is not an item`,
            });
        }
    }
    const mode = json.settings?.selectionMode ?? DEFAULT_SETTINGS.selectionMode;
    const selected = json.selectedItemIds?.length ?? 0;
    if (mode === "none" && selected > 0) {
        issues.push({
            path: at("/selectedItemIds"),
            message: 'must be empty when the selection mode is "none"',
        });
    }
    if (mode === "single" && selected > 1) {
        issues.push({
            path: at("/selectedItemIds"),
            message:
                'must hold at most one item when the selection mode is "single"',
        });
    }
    return issues;
}

/** The shape of a document that matched the schema (what the structure rules read). */
interface DocumentInput {
    readonly settings?: Partial<TreeSettings>;
    readonly rootItemIds: readonly string[];
    readonly items: {
        readonly [id: string]: {
            readonly id?: string;
            readonly kind: string;
            readonly label: string;
            readonly data?: unknown;
            readonly childItemIds?: readonly string[];
            readonly childrenStatus?: TreeItem["childrenStatus"];
        } & Readonly<Record<string, unknown>>;
    };
    readonly expandedItemIds?: readonly string[];
    readonly selectedItemIds?: readonly string[];
    readonly checkedItemIds?: readonly string[];
    readonly selectionAnchorItemId?: string | null;
    readonly focusedItemId?: string | null;
    readonly renamingItemId?: string | null;
}

/** An item of the document as state: its key as id, a loaded parent always with its list. */
export function itemFromJson(id: string, json: object): TreeItem {
    const item: Record<string, unknown> = { ...cloneJson(json), id };
    if (item.childrenStatus === "loaded" && item.childItemIds === undefined) {
        item.childItemIds = [];
    }
    if (
        item.childrenStatus !== undefined &&
        item.childrenStatus !== "loaded" &&
        item.childItemIds !== undefined
    ) {
        delete item.childItemIds;
    }
    // a stable key order: what `tree-json` writes back
    const { kind, label, data, childItemIds, childrenStatus, ...flags } = item;
    return {
        id,
        kind,
        label,
        ...(data === undefined ? {} : { data }),
        ...(childItemIds === undefined ? {} : { childItemIds }),
        ...(childrenStatus === undefined ? {} : { childrenStatus }),
        ...flags,
    } as unknown as TreeItem;
}

/**
 * Validates a document and builds its normalized state: defaults filled in, the cascade checks
 * made consistent, expanded leaves dropped, the focused item made visible. Every problem is an
 * issue with its JSON path under `prefix`.
 */
export function buildState(
    json: unknown,
    options: { dataSchemas?: DataSchemas | undefined; freeze: boolean },
    prefix = "",
): BuiltState {
    const schemaIssues = validate(treeSchema as JsonSchema, json, prefix);
    if (schemaIssues.length > 0) return { ok: false, issues: schemaIssues };
    const input = json as DocumentInput;
    const issues = structureIssues(input, prefix);
    for (const [key, item] of Object.entries(input.items)) {
        issues.push(
            ...dataIssues(
                options.dataSchemas,
                item.kind,
                item.data,
                `${prefix}${joinPointer("/items", key)}/data`,
            ),
        );
    }
    if (issues.length > 0) return { ok: false, issues };

    const items: Record<string, TreeItem> = {};
    for (const [key, item] of Object.entries(input.items)) {
        items[key] = itemFromJson(key, item);
    }
    const settings: TreeSettings = {
        ...DEFAULT_SETTINGS,
        ...(cloneJson(input.settings) ?? {}),
    };
    const base: TreeState = {
        settings,
        rootItemIds: [...input.rootItemIds],
        items,
        // an expanded leaf shows nothing: it is dropped
        expandedItemIds: (input.expandedItemIds ?? []).filter((id) => {
            const item = items[id];
            return item !== undefined && !isLeaf(item);
        }),
        selectedItemIds: [...(input.selectedItemIds ?? [])],
        checkedItemIds: [...(input.checkedItemIds ?? [])],
        selectionAnchorItemId: input.selectionAnchorItemId ?? null,
        focusedItemId: input.focusedItemId ?? null,
        renamingItemId: input.renamingItemId ?? null,
    };
    // loading draws no id: a document's ids are its keys
    const draft = new Draft(base, new IdSource());
    normalizeChecks(draft);
    const focused = draft.state.focusedItemId;
    if (focused !== null) {
        draft.set(
            "focusedItemId",
            nearestVisible(draft.state, focused) ?? null,
        );
    }
    const state = draft.state;
    return { ok: true, state: options.freeze ? deepFreeze(state) : state };
}

/** The problems of a document, each with its JSON path; empty when `createTreeModel` would load it. */
export function validateTree(
    json: unknown,
    options: { dataSchemas?: DataSchemas | undefined } = {},
): readonly ValidationIssue[] {
    const built = buildState(json, {
        dataSchemas: options.dataSchemas,
        freeze: false,
    });
    return built.ok ? [] : built.issues;
}
