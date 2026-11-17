// The warehouse's demo content and rules, framework-free: its locations as a tree document (JSON
// v1), five levels deep and a few thousand items, generated the same way on every load; the
// storage rules as middleware; and the stock totals, derived from the model once per state.
import {
    type TreeItemJson,
    type TreeJson,
    type TreeModel,
    type TreeState,
    veto,
} from "@fragiola/tree-vue";

/** How a zone is kept, and so what it may store. */
export type Climate = "ambient" | "cold" | "frozen" | "hazmat" | "returns";

/** How a product must be kept. */
export type Storage = Exclude<Climate, "returns">;

/** The warehouse's registry: each level of the hierarchy is a kind, with its own data. */
export type WarehouseTypes = {
    items: {
        site: { city: string };
        zone: { climate: Climate };
        aisle: undefined;
        rack: { levels: number };
        bin: { capacity: number };
        product: {
            sku: string;
            quantity: number;
            minimum: number;
            storage: Storage;
        };
    };
};

type ItemJson = TreeItemJson<WarehouseTypes>;

/** Whether a zone may keep a product: its own climate, or the returns area, which takes anything. */
export const accepts = (climate: Climate, storage: Storage) =>
    climate === "returns" || climate === storage;

/** What a product needs, in words. */
export const STORAGE_NAMES: Record<Storage, string> = {
    ambient: "dry storage",
    cold: "cold storage",
    frozen: "a freezer",
    hazmat: "the hazmat cage",
};

const ZONES: {
    id: string;
    code: string;
    label: string;
    climate: Climate;
    aisles: number;
}[] = [
    { id: "dry", code: "D", label: "Dry goods", climate: "ambient", aisles: 6 },
    {
        id: "cold",
        code: "C",
        label: "Cold storage",
        climate: "cold",
        aisles: 3,
    },
    { id: "frozen", code: "F", label: "Freezer", climate: "frozen", aisles: 2 },
    {
        id: "hazmat",
        code: "H",
        label: "Hazmat cage",
        climate: "hazmat",
        aisles: 1,
    },
    {
        id: "returns",
        code: "R",
        label: "Returns",
        climate: "returns",
        aisles: 1,
    },
];

const RACKS = 8;
const BINS = 8;
const CAPACITY = 120;

const CATALOG: Record<Storage, string[]> = {
    ambient: [
        "Rice 5 kg",
        "Olive oil 1 L",
        "Pasta 500 g",
        "Canned tomatoes",
        "Coffee beans 1 kg",
        "Paper towels",
        "Dish soap",
        "Oat flakes",
        "Sparkling water",
        "Breakfast cereal",
    ],
    cold: [
        "Milk 1 L",
        "Yogurt 4-pack",
        "Butter 250 g",
        "Cheddar 200 g",
        "Orange juice 1 L",
    ],
    frozen: [
        "Frozen peas 1 kg",
        "Ice cream 1 L",
        "Fish fillets",
        "Frozen pizza",
        "Berries mix",
    ],
    hazmat: [
        "Lithium batteries",
        "Bleach 5 L",
        "Aerosol paint",
        "Lighter fluid",
    ],
};

/** The products of the first bins, written out: the ones a reader (and the e2e spec) starts from. */
const KNOWN: Record<
    string,
    {
        id: string;
        label: string;
        storage: Storage;
        quantity: number;
        minimum: number;
    }[]
> = {
    "dry-a1-r1-b1": [
        {
            id: "rice",
            label: "Rice 5 kg",
            storage: "ambient",
            quantity: 40,
            minimum: 10,
        },
        {
            id: "olive-oil",
            label: "Olive oil 1 L",
            storage: "ambient",
            quantity: 4,
            minimum: 12,
        },
    ],
    "dry-a1-r1-b2": [
        {
            id: "pasta",
            label: "Pasta 500 g",
            storage: "ambient",
            quantity: 110,
            minimum: 20,
        },
    ],
    "dry-a1-r1-b3": [],
    "cold-a1-r1-b1": [
        {
            id: "milk",
            label: "Milk 1 L",
            storage: "cold",
            quantity: 30,
            minimum: 20,
        },
    ],
};

/** A small deterministic random source (a linear congruential generator): the same warehouse on every load. */
function random(seed: number) {
    let state = seed;
    return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
}

/** The warehouse: one site, five zones, their aisles, racks, bins and products. */
export function warehouse(): TreeJson<WarehouseTypes> {
    const next = random(42);
    const pick = <T>(list: readonly T[]) =>
        list[Math.floor(next() * list.length)] as T;
    const items: Record<string, ItemJson> = {};
    let sku = 10000;
    const add = (id: string, item: ItemJson) => {
        items[id] = item;
        return id;
    };
    const product = (
        id: string,
        label: string,
        storage: Storage,
        quantity: number,
        minimum: number,
    ) =>
        add(id, {
            kind: "product",
            label,
            // the one kind that moves (the locations inherit `settings.movable: false`)
            movable: true,
            data: { sku: `SKU-${sku++}`, quantity, minimum, storage },
        });

    const zoneIds = ZONES.map((zone) => {
        const aisleIds: string[] = [];
        for (let a = 1; a <= zone.aisles; a++) {
            const aisleId = `${zone.id}-a${a}`;
            const rackIds: string[] = [];
            for (let r = 1; r <= RACKS; r++) {
                const rackId = `${aisleId}-r${r}`;
                const binIds: string[] = [];
                for (let b = 1; b <= BINS; b++) {
                    const binId = `${rackId}-b${b}`;
                    const known = KNOWN[binId];
                    const productIds = known
                        ? known.map((p) =>
                              product(
                                  p.id,
                                  p.label,
                                  p.storage,
                                  p.quantity,
                                  p.minimum,
                              ),
                          )
                        : Array.from(
                              { length: Math.floor(next() * 3) },
                              (_, p) => {
                                  const storage: Storage =
                                      zone.climate === "returns"
                                          ? pick([
                                                "ambient",
                                                "cold",
                                                "hazmat",
                                            ] as const)
                                          : zone.climate;
                                  const minimum = 5 + Math.floor(next() * 20);
                                  // about one product in ten is under its minimum
                                  const quantity =
                                      next() < 0.1
                                          ? Math.floor(next() * minimum)
                                          : minimum + Math.floor(next() * 30);
                                  return product(
                                      `${binId}-p${p + 1}`,
                                      pick(CATALOG[storage]),
                                      storage,
                                      quantity,
                                      minimum,
                                  );
                              },
                          );
                    binIds.push(
                        add(binId, {
                            kind: "bin",
                            label: `Bin ${zone.code}${a}-${String(r).padStart(2, "0")}-${b}`,
                            data: { capacity: CAPACITY },
                            childItemIds: productIds,
                        }),
                    );
                }
                rackIds.push(
                    add(rackId, {
                        kind: "rack",
                        label: `Rack ${zone.code}${a}-${String(r).padStart(2, "0")}`,
                        data: { levels: BINS / 2 },
                        childItemIds: binIds,
                    }),
                );
            }
            aisleIds.push(
                add(aisleId, {
                    kind: "aisle",
                    label: `Aisle ${zone.code}${a}`,
                    childItemIds: rackIds,
                }),
            );
        }
        return add(zone.id, {
            kind: "zone",
            label: zone.label,
            data: { climate: zone.climate },
            childItemIds: aisleIds,
        });
    });
    add("site", {
        kind: "site",
        label: "Lisbon distribution center",
        data: { city: "Lisbon" },
        childItemIds: zoneIds,
    });
    return {
        version: 1,
        rootItemIds: ["site"],
        items,
        expandedItemIds: [
            "site",
            "dry",
            "dry-a1",
            "dry-a1-r1",
            "dry-a1-r1-b1",
            "dry-a1-r1-b2",
        ],
        // the locations stay where they are built: only products move
        settings: { movable: false },
    };
}

/** The zone an item is in (itself, for a zone), or undefined for the site. */
export function zoneOf(model: TreeModel<WarehouseTypes>, itemId: string) {
    let item = model.get("item-by", { id: itemId });
    while (item && item.kind !== "zone")
        item = model.get("item-parent-by", { itemId: item.id });
    return item?.kind === "zone" ? item : undefined;
}

/** The units a bin holds. */
export function unitsIn(model: TreeModel<WarehouseTypes>, binId: string) {
    return model
        .get("child-items-by", { itemId: binId })
        .reduce(
            (sum, item) =>
                sum + (item.kind === "product" ? item.data.quantity : 0),
            0,
        );
}

/**
 * The warehouse's storage rules, as one middleware: every move (a drag, a key, the details panel)
 * and every quantity change passes here. A product goes into a bin only, in a zone that may keep
 * it, without overfilling it. A refused move never shows as a drop target: a drag asks
 * `model.can("item.move", …)` for each one.
 */
export function storageRules(model: TreeModel<WarehouseTypes>) {
    return model.use((ctx, next) => {
        if (ctx.command === "item.move") {
            const { parentItemId } = ctx.payload.to;
            const bin =
                parentItemId === null
                    ? undefined
                    : ctx.get("item-by", { id: parentItemId });
            if (bin?.kind !== "bin") return veto("Products go into bins.");
            const climate = zoneOf(model, bin.id)?.data.climate ?? "returns";
            let arriving = 0;
            for (const itemId of ctx.payload.itemIds) {
                const item = ctx.get("item-by", { id: itemId });
                if (item?.kind !== "product")
                    return veto("Only products move.");
                if (!accepts(climate, item.data.storage))
                    return veto(
                        `${item.label} needs ${STORAGE_NAMES[item.data.storage]}.`,
                    );
                if (ctx.get("item-parent-by", { itemId })?.id !== bin.id)
                    arriving += item.data.quantity;
            }
            if (unitsIn(model, bin.id) + arriving > bin.data.capacity)
                return veto(`${bin.label} has no room for them.`);
        }
        if (ctx.command === "item.set-data") {
            const item = ctx.get("item-by", { id: ctx.payload.itemId });
            const data = ctx.payload.data;
            if (item?.kind === "product" && data && "quantity" in data) {
                if (!Number.isInteger(data.quantity) || data.quantity < 0)
                    return veto("A quantity is a whole number, 0 or more.");
                const bin = ctx.get("item-parent-by", { itemId: item.id });
                if (
                    bin?.kind === "bin" &&
                    unitsIn(model, bin.id) -
                        item.data.quantity +
                        data.quantity >
                        bin.data.capacity
                )
                    return veto(
                        `${bin.label} holds ${bin.data.capacity} units at most.`,
                    );
            }
        }
        return next();
    });
}

/** The stock of one item: the units under it, and how many of its products are under their minimum. */
export interface Stock {
    units: number;
    low: number;
}

/** The stock of every item, derived from one state of the model. */
export interface StockTotals {
    byItemId: ReadonlyMap<string, Stock>;
    /** the products under their minimum, in tree order */
    lowProductIds: readonly string[];
}

// Derived, never stored twice: computed once per state (a state is frozen, every command makes a
// new one), whatever number of rows read it. One pass, children before parents.
const totals = new WeakMap<TreeState<WarehouseTypes>, StockTotals>();

/** The stock totals of the model's current state. */
export function stockTotals(model: TreeModel<WarehouseTypes>): StockTotals {
    const cached = totals.get(model.state);
    if (cached) return cached;
    const byItemId = new Map<string, Stock>();
    const lowProductIds: string[] = [];
    const visit = (itemId: string): Stock => {
        const item = model.state.items[itemId];
        let stock: Stock = { units: 0, low: 0 };
        if (item?.kind === "product") {
            const low = item.data.quantity < item.data.minimum;
            if (low) lowProductIds.push(itemId);
            stock = { units: item.data.quantity, low: low ? 1 : 0 };
        } else {
            for (const childId of item?.childItemIds ?? []) {
                const child = visit(childId);
                stock = {
                    units: stock.units + child.units,
                    low: stock.low + child.low,
                };
            }
        }
        byItemId.set(itemId, stock);
        return stock;
    };
    for (const rootId of model.state.rootItemIds) visit(rootId);
    const result = { byItemId, lowProductIds };
    totals.set(model.state, result);
    return result;
}

/** The ids of an item's ancestors, from the root down. */
export function ancestorIds(model: TreeModel<WarehouseTypes>, itemId: string) {
    const ids: string[] = [];
    let parent = model.get("item-parent-by", { itemId });
    while (parent) {
        ids.unshift(parent.id);
        parent = model.get("item-parent-by", { itemId: parent.id });
    }
    return ids;
}

/** One step that expands the folders around every low-stock product, so each one shows. */
export function expandToLowStock(model: TreeModel<WarehouseTypes>) {
    const toExpand = new Set<string>();
    for (const productId of stockTotals(model).lowProductIds)
        for (const id of ancestorIds(model, productId))
            if (!model.is("item-expanded", { itemId: id })) toExpand.add(id);
    return model.run("batch", {
        commands: [...toExpand].map((itemId) => ({
            command: "item.expand" as const,
            payload: { itemId },
        })),
    });
}

/** The bins a product may move to: the ones the rules accept (`model.can`), with their zone's name. */
export function binsFor(model: TreeModel<WarehouseTypes>, productId: string) {
    const product = model.get("item-by", { id: productId });
    if (product?.kind !== "product") return [];
    const current = model.get("item-parent-by", { itemId: productId })?.id;
    return Object.values(model.state.items).flatMap((item) =>
        item.kind === "bin" &&
        item.id !== current &&
        model.can("item.move", {
            itemIds: [productId],
            to: {
                parentItemId: item.id,
                index: item.childItemIds?.length ?? 0,
            },
        })
            ? [
                  {
                      id: item.id,
                      label: `${item.label} · ${zoneOf(model, item.id)?.label ?? ""}`,
                  },
              ]
            : [],
    );
}

/** A number with thousands separators, the same in every locale the examples run in. */
export const formatUnits = (units: number) => units.toLocaleString("en");
