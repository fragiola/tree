// Composes a model's features once, when it is created: one function per contribution point, so
// nothing is looked up or allocated per item on a hot path. The engine finds its model's
// composition through `featuresOf(model)`, never through the model's public surface.
import type { CommandDefinition } from "../commands/define";
import type { ValidationIssue } from "../schema/types";
import type { Draft } from "../state/draft";
import type { TreeItem, TreeSettings } from "../state/types";
import {
    FEATURE_KEYS,
    type FeatureKeyKind,
    type FeatureName,
    ownerOf,
} from "./keys";
import type {
    AnyTreeFeature,
    FeatureDocument,
    FeatureDocumentContext,
    FeatureState,
    TreeFeatureInfo,
} from "./types";

/** A model's features, composed. */
export interface ComposedFeatures {
    readonly list: readonly AnyTreeFeature[];
    readonly info: readonly TreeFeatureInfo[];
    /** the installed features' settings, with their defaults */
    readonly settings: Readonly<Record<string, unknown>>;
    /** the installed features' state fields */
    readonly fields: readonly string[];
    /** the installed features' commands, by name */
    readonly commands: ReadonlyMap<string, CommandDefinition>;
    readonly getters: ReadonlyMap<
        string,
        (state: FeatureState, payload: unknown) => unknown
    >;
    readonly questions: ReadonlyMap<
        string,
        (state: FeatureState, payload: unknown) => boolean
    >;
    /** the feature that owns `key` of kind `kind` when it is not installed */
    missing(kind: FeatureKeyKind, key: string): FeatureName | undefined;
    issues(
        json: FeatureDocument,
        context: FeatureDocumentContext,
    ): ValidationIssue[];
    load(
        json: FeatureDocument,
        items: { readonly [id: string]: TreeItem },
        settings: TreeSettings & Readonly<Record<string, unknown>>,
    ): Record<string, unknown>;
    toJson(state: FeatureState): Record<string, unknown>;
    forget(draft: Draft, removed: ReadonlySet<string>): void;
    disabled(draft: Draft, itemId: string): void;
    configured(draft: Draft, before: FeatureState["settings"]): void;
    tabStop(state: FeatureState): readonly string[];
    /** the installed features' attributes of an item, merged (none: one shared empty object) */
    itemAttributes(
        state: FeatureState,
        itemId: string,
    ): Readonly<Record<string, string | undefined>>;
    /** the installed features' attributes of the root, merged */
    rootAttributes(
        state: FeatureState,
    ): Readonly<Record<string, string | undefined>>;
}

const NO_ATTRIBUTES: Readonly<Record<string, string | undefined>> =
    Object.freeze({});

/** Merges the attributes of each contribution (one alone is returned as it is). */
function mergeAttributes(
    all: readonly (Readonly<Record<string, string | undefined>> | undefined)[],
): Readonly<Record<string, string | undefined>> {
    let only: Readonly<Record<string, string | undefined>> | undefined;
    let merged: Record<string, string | undefined> | undefined;
    for (const attributes of all) {
        if (!attributes) continue;
        if (only === undefined) only = attributes;
        else merged = { ...(merged ?? only), ...attributes };
    }
    return merged ?? only ?? NO_ATTRIBUTES;
}

/** The message of a key or field whose feature is not installed. */
export function requiresFeature(name: FeatureName): string {
    return `requires the ${name} feature (\`@fragiola/tree/${name}\`)`;
}

/**
 * Composes a list of features: each name once, every requirement installed (else it throws, naming
 * what is missing).
 */
export function composeFeatures(
    list: readonly AnyTreeFeature[] = [],
): ComposedFeatures {
    const installed = new Set<FeatureName>();
    for (const feature of list) {
        if (installed.has(feature.name)) {
            throw new Error(
                `The ${feature.name} feature is installed twice: pass it once in \`features\``,
            );
        }
        installed.add(feature.name);
    }
    const missingRequirements = list.flatMap((feature) =>
        (feature.requires ?? [])
            .filter((name) => !installed.has(name))
            .map((name) => `${feature.name} requires ${name}`),
    );
    if (missingRequirements.length > 0) {
        throw new Error(
            `Missing features: ${missingRequirements.join(", ")}. Add them to \`features\``,
        );
    }

    const commands = new Map<string, CommandDefinition>();
    const getters = new Map<
        string,
        (state: FeatureState, payload: unknown) => unknown
    >();
    const questions = new Map<
        string,
        (state: FeatureState, payload: unknown) => boolean
    >();
    let settings: Record<string, unknown> = {};
    const fields: string[] = [];
    for (const feature of list) {
        for (const command of feature.commands ?? [])
            commands.set(command.name, command);
        for (const [key, getter] of Object.entries(feature.get ?? {}))
            getters.set(
                key,
                getter as (state: FeatureState, payload: unknown) => unknown,
            );
        for (const [key, question] of Object.entries(feature.is ?? {}))
            questions.set(
                key,
                question as (state: FeatureState, payload: unknown) => boolean,
            );
        settings = { ...settings, ...feature.settings };
        fields.push(...FEATURE_KEYS[feature.name].fields);
    }
    const withLoad = list.filter((feature) => feature.load);
    const each = <K extends keyof AnyTreeFeature>(key: K) =>
        list.filter((feature) => feature[key] !== undefined);
    const issuers = each("issues");
    const writers = each("toJson");
    const forgetters = each("forget");
    const disablers = each("disabled");
    const configurers = each("configured");
    const tabStops = each("tabStop");
    const itemAttributers = each("itemAttributes");
    const rootAttributers = each("rootAttributes");

    const composed: ComposedFeatures = {
        list,
        info: Object.freeze(
            list.map((feature) =>
                Object.freeze({
                    name: feature.name,
                    rootProps: Object.freeze([...(feature.rootProps ?? [])]),
                }),
            ),
        ),
        settings: Object.freeze(settings),
        fields: Object.freeze(fields),
        commands,
        getters,
        questions,
        missing: (kind, key) => {
            const owner = ownerOf(kind, key);
            return owner !== undefined && !installed.has(owner)
                ? owner
                : undefined;
        },
        issues: (json, context) =>
            issuers.flatMap((feature) => feature.issues?.(json, context) ?? []),
        load: (json, items, loadedSettings) =>
            Object.assign(
                {},
                ...withLoad.map((feature) =>
                    feature.load?.(json, items, loadedSettings),
                ),
            ),
        toJson: (state) =>
            Object.assign(
                {},
                ...writers.map((feature) => feature.toJson?.(state)),
            ),
        forget: (draft, removed) => {
            for (const feature of forgetters) feature.forget?.(draft, removed);
        },
        disabled: (draft, itemId) => {
            for (const feature of disablers) feature.disabled?.(draft, itemId);
        },
        configured: (draft, before) => {
            for (const feature of configurers)
                feature.configured?.(draft, before);
        },
        tabStop: (state) =>
            tabStops.flatMap((feature) => feature.tabStop?.(state) ?? []),
        itemAttributes: (state, itemId) =>
            itemAttributers.length === 0
                ? NO_ATTRIBUTES
                : mergeAttributes(
                      itemAttributers.map((feature) =>
                          feature.itemAttributes?.(state, itemId),
                      ),
                  ),
        rootAttributes: (state) =>
            rootAttributers.length === 0
                ? NO_ATTRIBUTES
                : mergeAttributes(
                      rootAttributers.map((feature) =>
                          feature.rootAttributes?.(state),
                      ),
                  ),
    };
    return Object.freeze(composed);
}

/** No feature: a bare tree. */
export const NO_FEATURES: ComposedFeatures = composeFeatures([]);

const byModel = new WeakMap<object, ComposedFeatures>();

/** Records a model's composed features (`createTreeModel`). */
export function registerFeatures(
    model: object,
    features: ComposedFeatures,
): void {
    byModel.set(model, features);
}

/** A model's composed features (a bare tree's for an object that is not a model). */
export function featuresOf(model: object): ComposedFeatures {
    return byModel.get(model) ?? NO_FEATURES;
}
