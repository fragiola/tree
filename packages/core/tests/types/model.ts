// Type fixtures (compiled by `pnpm typecheck`, never run): the registry types the items' data, the
// commands' payloads and the queries. `@ts-expect-error` marks what must not compile.
import { selection } from "../../src/selection/selection";
import { createTreeModel, type TreeModel } from "../../src/state/model";
import type { ItemOf } from "../../src/state/types";
import { virtualization } from "../../src/virtual/virtualization";

type Types = { items: { folder: undefined; file: { size: number } } };

const features = [selection()] as const;

const model = createTreeModel<Types, typeof features>(
    {
        version: 1,
        rootItemIds: ["a"],
        items: {
            a: { kind: "folder", label: "a", childItemIds: ["b"] },
            b: { kind: "file", label: "b", data: { size: 1 } },
        },
    },
    { features },
);

// the features are inferred when the registry is
const inferred = createTreeModel(
    { version: 1, rootItemIds: [], items: {} },
    { features: [selection(), virtualization()] },
);
inferred.run("tree.select-all", {});
const selectedIds: readonly string[] = inferred.state.selectedItemIds;
void selectedIds;

// a bare tree: no selection command, key or state
const bare = createTreeModel<Types>();
// @ts-expect-error the selection feature is not installed
bare.run("item.select", { itemId: "b" });
// @ts-expect-error the selection feature is not installed
bare.get("selected-items");
// @ts-expect-error the selection feature is not installed
bare.is("item-selected", { itemId: "b" });
// @ts-expect-error the selection feature is not installed
void bare.state.selectedItemIds;
bare.run("item.expand", { itemId: "a" });

// a model with more features is a model with fewer (an adapter's parts take any)
const anyModel: TreeModel<Types> = model;
void anyModel;

createTreeModel<Types>({
    version: 1,
    rootItemIds: ["b"],
    items: {
        // @ts-expect-error a file's data is required
        b: { kind: "file", label: "b" },
    },
});

createTreeModel<Types>({
    version: 1,
    rootItemIds: ["b"],
    // @ts-expect-error a file's data is { size: number }
    items: { b: { kind: "file", label: "b", data: { size: "big" } } },
});

createTreeModel<Types>({
    version: 1,
    rootItemIds: ["c"],
    // @ts-expect-error "note" is not a kind of the registry
    items: { c: { kind: "note", label: "c" } },
});

// the data narrows on the kind
export function size(item: ItemOf<Types>): number {
    if (item.kind === "file") return item.data.size;
    // @ts-expect-error a folder has no data
    return item.data.size;
}

model.run("item.add", {
    item: { kind: "file", label: "c", data: { size: 2 } },
    to: { parentItemId: "a" },
});
model.run("item.add", {
    // @ts-expect-error a file needs its data
    item: { kind: "file", label: "c" },
    to: { parentItemId: "a" },
});
model.run("item.set-data", { itemId: "b", data: { size: 3 } });
// @ts-expect-error the data is one of the registry's
model.run("item.set-data", { itemId: "b", data: { size: "x" } });
// @ts-expect-error an id field is `itemId`
model.run("item.expand", { id: "a" });
// @ts-expect-error not a command
model.run("item.fly", {});
model.run("item.select", { itemId: "b", mode: "extend" });
// @ts-expect-error not a selection mode
model.run("item.select", { itemId: "b", mode: "all" });

const result = model.run("item.toggle", { itemId: "a" });
if (result.ok) {
    const expanded: boolean = result.value.expanded;
    void expanded;
}

// queries: the payload is required exactly when the key takes one
model.get("visible-items");
model.get("item-by", { id: "a" });
// @ts-expect-error item-by takes { id }
model.get("item-by");
const file = model.get("item-by", { id: "b" });
if (file?.kind === "file") {
    const n: number = file.data.size;
    void n;
}
model.is("item-expanded", { itemId: "a" });
// @ts-expect-error not a question
model.is("item-flying", { itemId: "a" });

// middleware: the command narrows the payload
model.use((ctx, next) => {
    if (ctx.command === "item.move") {
        const ids: string[] = ctx.payload.itemIds;
        void ids;
    }
    return next();
});
