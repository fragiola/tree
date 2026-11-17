// The type-ahead feature: `typeAhead({ timeout })` moves focus to the next visible item whose label
// starts with the characters typed (the APG tree's printable characters), and gives the model the
// `type-ahead-match` key. A tree without it leaves typed characters alone.
import type { KeyEventInput } from "../engine/adapter";
import type {
    FeatureEngine,
    FeatureEngineHost,
    FeatureState,
    TreeFeature,
} from "../features/types";
import { itemOf } from "../state/structure";
import { visibleIndex, visibleItems } from "../state/visible-items";
import { TypeAhead } from "./search";

/** Options of {@link typeAhead}. */
export interface TypeAheadOptions {
    /** how long (ms) between two typed characters keeps one search (default 500) */
    timeout?: number | undefined;
}

/** The type-ahead feature, as `features` holds it. */
export type TypeAheadFeature = TreeFeature<"type-ahead">;

/** A key that types a character for type-ahead: one printable character, no Control, Meta or Alt. */
function isTypeAheadKey(event: KeyEventInput): boolean {
    return (
        event.key.length === 1 &&
        event.key !== " " &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
    );
}

function typeAheadMatch(
    state: FeatureState,
    text: string,
    fromItemId: string | null | undefined,
): string | undefined {
    const needle = text.toLocaleLowerCase();
    if (needle === "") return undefined;
    const visible = visibleItems(state);
    const start =
        fromItemId === null || fromItemId === undefined
            ? -1
            : (visibleIndex(state).get(fromItemId) ?? -1);
    for (let step = 1; step <= visible.length; step++) {
        const entry = visible[(start + step) % visible.length];
        const label = entry && itemOf(state, entry.itemId)?.label;
        if (label?.toLocaleLowerCase().startsWith(needle)) return entry?.itemId;
    }
    return undefined;
}

function typeAheadEngine(
    host: FeatureEngineHost,
    timeout: number,
): FeatureEngine {
    const { model } = host;
    const search = new TypeAhead(() => host.scheduler(), timeout);
    return {
        unboundKey(event: KeyEventInput): boolean | undefined {
            if (!isTypeAheadKey(event)) return undefined;
            const current = host.current();
            const { text, cycle } = search.type(event.key);
            let fromItemId: string | null | undefined = current;
            if (!cycle && current !== undefined) {
                // a longer search may stay on the current item: start just before it
                const visible = host.visible();
                const at = host.visibleIndex().get(current) ?? -1;
                fromItemId = at > 0 ? (visible[at - 1]?.itemId ?? null) : null;
            }
            const match = typeAheadMatch(model.state, text, fromItemId);
            if (match !== undefined) host.focus(match);
            return true;
        },
        keysReset: () => search.reset(),
        destroy: () => search.reset(),
    };
}

/**
 * The type-ahead feature: typing characters moves focus to the next visible item whose label
 * starts with them (the same character again cycles), and `model.get("type-ahead-match")`.
 *
 * ```ts
 * import { typeAhead } from "@fragiola/tree/type-ahead";
 * const model = createTreeModel(json, { features: [typeAhead()] });
 * ```
 */
export function typeAhead(options: TypeAheadOptions = {}): TypeAheadFeature {
    const timeout = options.timeout ?? 500;
    return Object.freeze({
        name: "type-ahead",
        get: {
            "type-ahead-match": (
                state: FeatureState,
                {
                    text,
                    fromItemId,
                }: { text: string; fromItemId?: string | null },
            ) => {
                const id = typeAheadMatch(state, text, fromItemId);
                return id === undefined ? undefined : itemOf(state, id);
            },
        },
        engine: (host) => typeAheadEngine(host, timeout),
    } satisfies TypeAheadFeature);
}
