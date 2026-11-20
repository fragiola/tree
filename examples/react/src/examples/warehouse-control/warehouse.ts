// The control room's demo content and rules, framework-free: two sites, their zones, aisles and
// bins as a tree document (JSON v1), generated the same way on every load; the storage rules as
// middleware; the stock figures of any location, derived once per state of the model; and how a
// tick of the live feed becomes commands.
import {
    type TreeItemJson,
    type TreeJson,
    type TreeModel,
    type TreeState,
    veto,
} from "@fragiola/tree-react";
import {
    type BinStock,
    type Movement,
    randomSource,
} from "../_kit/warehouse-live";

/** How a zone is kept, and so what it may store. */
export type Climate = "ambient" | "cold" | "frozen" | "hazmat" | "returns";

/** How a product must be kept. */
export type Storage = Exclude<Climate, "returns">;

/** The registry: each level of the hierarchy is a kind; a bin holds one product. */
export type ControlTypes = {
    items: {
        site: { city: string };
        zone: { climate: Climate };
        aisle: undefined;
        bin: {
            product: string;
            storage: Storage;
            quantity: number;
            capacity: number;
            /** under it, the bin is low on stock */
            minimum: number;
        };
    };
};

export type ControlModel = TreeModel<ControlTypes>;

type ItemJson = TreeItemJson<ControlTypes>;

/** Whether a zone may keep a product: its own climate, or returns, which takes anything. */
export const accepts = (climate: Climate, storage: Storage) =>
    climate === "returns" || climate === storage;

/** What a product needs, in words. */
export const STORAGE_NAMES: Record<Storage, string> = {
    ambient: "dry storage",
    cold: "cold storage",
    frozen: "a freezer",
    hazmat: "the hazmat cage",
};

const CATALOG: Record<Storage, readonly string[]> = {
    ambient: [
        "Rice 5 kg",
        "Olive oil 1 L",
        "Pasta 500 g",
        "Coffee beans",
        "Canned tomatoes",
        "Paper towels",
        "Oat flakes",
        "Dish soap",
    ],
    cold: ["Milk 1 L", "Yogurt 4-pack", "Butter 250 g", "Cheddar 200 g"],
    frozen: ["Frozen peas", "Ice cream 1 L", "Fish fillets", "Frozen pizza"],
    hazmat: ["Lithium batteries", "Bleach 5 L", "Aerosol paint"],
};

const SITES: {
    id: string;
    label: string;
    city: string;
    zones: { id: string; label: string; climate: Climate; aisles: number }[];
}[] = [
    {
        id: "lisbon",
        label: "Lisbon DC",
        city: "Lisbon",
        zones: [
            { id: "dry", label: "Dry goods", climate: "ambient", aisles: 3 },
            { id: "cold", label: "Cold storage", climate: "cold", aisles: 2 },
            { id: "frozen", label: "Freezer", climate: "frozen", aisles: 2 },
            {
                id: "hazmat",
                label: "Hazmat cage",
                climate: "hazmat",
                aisles: 1,
            },
        ],
    },
    {
        id: "porto",
        label: "Porto hub",
        city: "Porto",
        zones: [
            { id: "dry", label: "Dry goods", climate: "ambient", aisles: 2 },
            { id: "cold", label: "Cold storage", climate: "cold", aisles: 1 },
            { id: "returns", label: "Returns", climate: "returns", aisles: 1 },
        ],
    },
];

const BINS = 5;
const CAPACITY = 120;

/** The first bins, written out: the ones a reader (and the e2e spec) starts from. */
const KNOWN: Record<
    string,
    { product: string; quantity: number; minimum: number }
> = {
    "lisbon-dry-a1-b1": { product: "Rice 5 kg", quantity: 84, minimum: 20 },
    "lisbon-dry-a1-b2": {
        product: "Olive oil 1 L",
        quantity: 9,
        minimum: 15,
    },
    "lisbon-dry-a1-b3": {
        product: "Pasta 500 g",
        quantity: 112,
        minimum: 20,
    },
};

/** The network: two sites, their zones, aisles and bins, the same on every load. */
export function network(): TreeJson<ControlTypes> {
    const random = randomSource(42);
    const pick = <T>(list: readonly T[]) =>
        list[Math.floor(random() * list.length)] as T;
    const items: Record<string, ItemJson> = {};
    const add = (id: string, item: ItemJson) => {
        items[id] = item;
        return id;
    };
    const siteIds = SITES.map((site) => {
        const zoneIds = site.zones.map((zone) => {
            const zoneId = `${site.id}-${zone.id}`;
            const code = `${site.label[0]}${zone.label[0]}`;
            const aisleIds = Array.from({ length: zone.aisles }, (_, a) => {
                const aisleId = `${zoneId}-a${a + 1}`;
                const binIds = Array.from({ length: BINS }, (_, b) => {
                    const binId = `${aisleId}-b${b + 1}`;
                    const storage: Storage =
                        zone.climate === "returns"
                            ? pick(["ambient", "cold", "hazmat"] as const)
                            : zone.climate;
                    const minimum = 10 + Math.floor(random() * 4) * 5;
                    // about one bin in six starts under its minimum
                    const quantity =
                        random() < 0.16
                            ? Math.floor(random() * minimum)
                            : minimum +
                              Math.floor(random() * (CAPACITY - minimum));
                    const known = KNOWN[binId];
                    return add(binId, {
                        kind: "bin",
                        label: `Bin ${code}${a + 1}-${b + 1}`,
                        // the one kind that moves (the locations inherit `settings.movable: false`)
                        movable: true,
                        data: {
                            product: known?.product ?? pick(CATALOG[storage]),
                            storage,
                            quantity: known?.quantity ?? quantity,
                            capacity: CAPACITY,
                            minimum: known?.minimum ?? minimum,
                        },
                    });
                });
                return add(aisleId, {
                    kind: "aisle",
                    label: `Aisle ${code}${a + 1}`,
                    childItemIds: binIds,
                });
            });
            return add(zoneId, {
                kind: "zone",
                label: zone.label,
                data: { climate: zone.climate },
                childItemIds: aisleIds,
            });
        });
        return add(site.id, {
            kind: "site",
            label: site.label,
            data: { city: site.city },
            childItemIds: zoneIds,
        });
    });
    return {
        version: 1,
        rootItemIds: siteIds,
        items,
        expandedItemIds: ["lisbon", "lisbon-dry", "lisbon-dry-a1", "porto"],
        // the locations stay where they are built: only bins move
        settings: { movable: false },
    };
}

/** The zone an item is in (itself, for a zone), or undefined for a site. */
export function zoneOf(model: ControlModel, itemId: string) {
    let item = model.get("item-by", { id: itemId });
    while (item && item.kind !== "zone" && item.kind !== "site")
        item = model.get("item-parent-by", { itemId: item.id });
    return item?.kind === "zone" ? item : undefined;
}

/** The most bins an aisle holds. */
export const AISLE_SLOTS = 8;

/**
 * The storage rules, as one middleware: every move (a drag, a key) and every quantity change (the
 * live feed) passes here. A bin goes into an aisle only, of a zone that may keep its product, with
 * a free slot; a quantity stays a whole number between 0 and the bin's capacity. A refused move
 * never shows as a drop target: a drag asks `model.can("item.move", …)` for each one.
 */
export function storageRules(model: ControlModel) {
    return model.use((ctx, next) => {
        if (ctx.command === "item.move") {
            const { parentItemId } = ctx.payload.to;
            const aisle =
                parentItemId === null
                    ? undefined
                    : ctx.get("item-by", { id: parentItemId });
            if (aisle?.kind !== "aisle") return veto("Bins go into aisles.");
            const climate = zoneOf(model, aisle.id)?.data.climate ?? "returns";
            let arriving = 0;
            for (const itemId of ctx.payload.itemIds) {
                const item = ctx.get("item-by", { id: itemId });
                if (item?.kind !== "bin") return veto("Only bins move.");
                if (!accepts(climate, item.data.storage))
                    return veto(
                        `${item.data.product} needs ${STORAGE_NAMES[item.data.storage]}.`,
                    );
                if (ctx.get("item-parent-by", { itemId })?.id !== aisle.id)
                    arriving++;
            }
            if ((aisle.childItemIds?.length ?? 0) + arriving > AISLE_SLOTS)
                return veto(`${aisle.label} has no free slot.`);
        }
        if (ctx.command === "item.set-data") {
            const item = ctx.get("item-by", { id: ctx.payload.itemId });
            const data = ctx.payload.data;
            if (item?.kind === "bin" && data && "quantity" in data) {
                const { quantity } = data;
                if (
                    !Number.isInteger(quantity) ||
                    quantity < 0 ||
                    quantity > item.data.capacity
                )
                    return veto(
                        `${item.label} holds 0 to ${item.data.capacity} units.`,
                    );
            }
        }
        return next();
    });
}

/** The stock under one location: units, room, bins and the bins under their minimum. */
export interface Stock {
    units: number;
    capacity: number;
    bins: number;
    low: number;
}

const EMPTY: Stock = { units: 0, capacity: 0, bins: 0, low: 0 };

// Derived, never stored twice: computed once per state (a state is frozen, every command makes a
// new one), whatever number of rows and panels read it. One pass, children before parents.
const cache = new WeakMap<
    TreeState<ControlTypes>,
    ReadonlyMap<string, Stock>
>();

/** The stock of every location in one state of the model, by item id. */
export function stockOf(
    state: TreeState<ControlTypes>,
): ReadonlyMap<string, Stock> {
    const cached = cache.get(state);
    if (cached) return cached;
    const byItemId = new Map<string, Stock>();
    const visit = (itemId: string): Stock => {
        const item = state.items[itemId];
        let stock = EMPTY;
        if (item?.kind === "bin") {
            stock = {
                units: item.data.quantity,
                capacity: item.data.capacity,
                bins: 1,
                low: item.data.quantity < item.data.minimum ? 1 : 0,
            };
        } else {
            for (const childId of item?.childItemIds ?? []) {
                const child = visit(childId);
                stock = {
                    units: stock.units + child.units,
                    capacity: stock.capacity + child.capacity,
                    bins: stock.bins + child.bins,
                    low: stock.low + child.low,
                };
            }
        }
        byItemId.set(itemId, stock);
        return stock;
    };
    let total = EMPTY;
    for (const rootId of state.rootItemIds) {
        const site = visit(rootId);
        total = {
            units: total.units + site.units,
            capacity: total.capacity + site.capacity,
            bins: total.bins + site.bins,
            low: total.low + site.low,
        };
    }
    // the whole network, under the empty id: the scope with nothing selected
    byItemId.set("", total);
    cache.set(state, byItemId);
    return byItemId;
}

/** The stock of a scope (an item id, or "" for the whole network) in one state. */
export const stockIn = (state: TreeState<ControlTypes>, scopeId: string) =>
    stockOf(state).get(scopeId) ?? EMPTY;

/** The bins under a scope (itself, for a bin), in tree order. */
export function binsIn(
    state: TreeState<ControlTypes>,
    scopeId: string,
): Extract<TreeState<ControlTypes>["items"][string], { kind: "bin" }>[] {
    const bins: Extract<
        TreeState<ControlTypes>["items"][string],
        { kind: "bin" }
    >[] = [];
    const visit = (itemId: string) => {
        const item = state.items[itemId];
        if (item?.kind === "bin") bins.push(item);
        else for (const childId of item?.childItemIds ?? []) visit(childId);
    };
    for (const id of scopeId === "" ? state.rootItemIds : [scopeId]) visit(id);
    return bins;
}

/** Whether an item is a scope (itself, or one of its ancestors). */
export function isWithin(model: ControlModel, itemId: string, scopeId: string) {
    if (scopeId === "") return true;
    for (
        let item = model.get("item-by", { id: itemId });
        item;
        item = model.get("item-parent-by", { itemId: item.id })
    )
        if (item.id === scopeId) return true;
    return false;
}

/** The ids of an item's ancestors, from the root down. */
export function ancestorIds(model: ControlModel, itemId: string) {
    const ids: string[] = [];
    let parent = model.get("item-parent-by", { itemId });
    while (parent) {
        ids.unshift(parent.id);
        parent = model.get("item-parent-by", { itemId: parent.id });
    }
    return ids;
}

/** Where an item is, in words: its ancestors' labels. */
export const pathOf = (model: ControlModel, itemId: string) =>
    ancestorIds(model, itemId)
        .map((id) => model.get("item-by", { id })?.label ?? id)
        .join(" › ");

/** The bins as the live feed needs them, read from the model's current state. */
export const binStocks = (model: ControlModel): BinStock[] =>
    binsIn(model.state, "").map((bin) => ({
        id: bin.id,
        quantity: bin.data.quantity,
        capacity: bin.data.capacity,
        minimum: bin.data.minimum,
    }));

/**
 * One tick of the feed, applied through the model: one `batch` of `item.set-data`, so the storage
 * rules see every change and the tree, its totals and its flags update in one render.
 */
export function applyMovements(
    model: ControlModel,
    movements: readonly Movement[],
) {
    const commands = movements.flatMap((movement) => {
        const bin = model.get("item-by", { id: movement.binId });
        return bin?.kind === "bin"
            ? [
                  {
                      command: "item.set-data" as const,
                      payload: {
                          itemId: bin.id,
                          data: { ...bin.data, quantity: movement.quantity },
                      },
                  },
              ]
            : [];
    });
    return commands.length === 0 ? undefined : model.run("batch", { commands });
}

/** One bar of the fill chart: a location under the scope, and how full it is. */
export interface FillBar {
    id: string;
    label: string;
    units: number;
    capacity: number;
    low: number;
    /** the selected item itself (a bin is drawn among its aisle's bins) */
    current: boolean;
}

/**
 * The fill chart's bars for a scope: every zone of the network, a site's zones, a zone's aisles,
 * an aisle's bins; a bin is drawn among its aisle's bins.
 */
export function fillBars(model: ControlModel, scopeId: string): FillBar[] {
    const state = model.state;
    const bar = (id: string, label: string): FillBar => {
        const stock = stockIn(state, id);
        return {
            id,
            label,
            units: stock.units,
            capacity: stock.capacity,
            low: stock.low,
            current: id === scopeId,
        };
    };
    if (scopeId === "")
        // every zone, named with its site's city (two sites have dry goods)
        return state.rootItemIds.flatMap((siteId) => {
            const site = model.get("item-by", { id: siteId });
            const city = site?.kind === "site" ? site.data.city : "";
            return model
                .get("child-items-by", { itemId: siteId })
                .map((zone) => bar(zone.id, `${city} · ${zone.label}`));
        });
    const scope = model.get("item-by", { id: scopeId });
    const parentId =
        scope?.kind === "bin"
            ? model.get("item-parent-by", { itemId: scopeId })?.id
            : scopeId;
    return parentId === undefined
        ? []
        : model
              .get("child-items-by", { itemId: parentId })
              .map((child) => bar(child.id, child.label));
}

/** What the chart's bars are, for a scope: its title says it. */
export function fillTitle(model: ControlModel, scopeId: string) {
    const kind = model.get("item-by", { id: scopeId })?.kind;
    return kind === "zone"
        ? "Fill by aisle"
        : kind === "aisle" || kind === "bin"
          ? "Fill by bin"
          : "Fill by zone";
}

/** A number with thousands separators, the same in every locale the examples run in. */
export const formatUnits = (units: number) => units.toLocaleString("en");

/** A ratio as a whole percentage. */
export const formatPercent = (ratio: number) =>
    `${Math.round(Number.isFinite(ratio) ? ratio * 100 : 0)}%`;

/** What the panels keep of the live feed: the last movements and the last states of the model. */
export interface LiveLog {
    /** newest first */
    movements: readonly Movement[];
    /** oldest first: what the sparkline draws */
    states: readonly TreeState<ControlTypes>[];
}

const KEPT_MOVEMENTS = 60;
const KEPT_STATES = 30;

/** The log after a tick: its movements, and the state they left the model in. */
export const logTick = (
    log: LiveLog,
    movements: readonly Movement[],
    state: TreeState<ControlTypes>,
): LiveLog => ({
    movements: [...[...movements].reverse(), ...log.movements].slice(
        0,
        KEPT_MOVEMENTS,
    ),
    states: [...log.states, state].slice(-KEPT_STATES),
});

/** The movements in a scope, newest first. */
export const movementsIn = (
    model: ControlModel,
    log: LiveLog,
    scopeId: string,
) =>
    log.movements.filter((movement) =>
        isWithin(model, movement.binId, scopeId),
    );

/** The units moved in a scope in the last simulated minute. */
export function unitsMoved(model: ControlModel, log: LiveLog, scopeId: string) {
    const latest = log.movements[0]?.time ?? 0;
    return movementsIn(model, log, scopeId)
        .filter((movement) => movement.time > latest - 60)
        .reduce((sum, movement) => sum + Math.abs(movement.delta), 0);
}

/** A row's description: its stock, and its low-stock flag. */
export function describe(state: TreeState<ControlTypes>, itemId: string) {
    const item = state.items[itemId];
    if (item?.kind === "bin") {
        const { quantity, capacity, minimum, product } = item.data;
        return `${quantity} of ${capacity} units${quantity < minimum ? `, low stock (minimum ${minimum})` : ""}, ${product}`;
    }
    const stock = stockIn(state, itemId);
    return `${formatUnits(stock.units)} units, ${formatPercent(stock.units / stock.capacity)} full${stock.low > 0 ? `, ${stock.low} ${stock.low === 1 ? "bin" : "bins"} low on stock` : ""}`;
}

/** The bins of a scope the table lists: the emptiest first, at most `limit`. */
export function lowestBins(
    state: TreeState<ControlTypes>,
    scopeId: string,
    limit: number,
) {
    return binsIn(state, scopeId)
        .sort(
            (a, b) =>
                a.data.quantity / a.data.capacity -
                    b.data.quantity / b.data.capacity ||
                a.label.localeCompare(b.label),
        )
        .slice(0, limit);
}
