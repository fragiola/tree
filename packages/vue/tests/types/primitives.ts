// Type fixtures, checked by `tsc` (not run): the registry `T` flows from the model into the parts'
// props and scoped slots (through `typedTree<T>()`) and into the composables, with no cast.
import { h, shallowRef } from "vue";
import {
    createTreeModel,
    createTreeRef,
    type ItemOf,
    typedTree,
    type Tree as Untyped,
    useTree,
    useTreeItem,
    useTreeState,
} from "../../src";

type Types = {
    items: { folder: undefined; file: { size: number } };
};

const model = createTreeModel<Types>({
    version: 1,
    rootItemIds: ["a"],
    items: { a: { kind: "file", label: "a.ts", data: { size: 1 } } },
});

const Tree = typedTree<Types>();

/** what a component's scoped slot `K` receives */
type SlotScope<
    C extends abstract new (
        ...args: never
    ) => { $slots: object },
    K extends keyof InstanceType<C>["$slots"],
> = Parameters<NonNullable<InstanceType<C>["$slots"][K]>>[0];

// the slots give the registry's items: `data` narrows on `kind`
type ItemsScope = SlotScope<typeof Tree.Items, "default">;
const fromItems = (scope: ItemsScope): number =>
    scope.item.kind === "file" ? scope.item.data.size : 0;
type GroupScope = SlotScope<typeof Tree.Group, "default">;
const fromGroup = (scope: GroupScope): ItemOf<Types> => scope.item;
void fromItems;
void fromGroup;

// the untyped namespace is the same objects
const same: typeof Untyped.Root = Tree.Root as typeof Untyped.Root;
void same;

// the root takes the typed model, its v-model lists and events
h(Tree.Root, {
    model,
    expandedItemIds: ["a"],
    "onUpdate:expandedItemIds": (itemIds: string[]) => itemIds.length,
    checkboxes: true,
    treeRef: createTreeRef<Types>(),
});
h(Tree.RenameInput, {
    onRenameError: (error) => error.code,
});
// a tree ref is not a Vue ref: `value` is the handle, read-only, and a ref of the app's own is not
// a tree ref (a template would unwrap it)
const tree = createTreeRef<Types>();
tree.value?.model.run("item.expand", { itemId: "a" });
// @ts-expect-error: only the root sets the handle
tree.value = null;
// @ts-expect-error: a Vue ref is not a tree ref
h(Tree.Root, { model, treeRef: shallowRef(null) });
// @ts-expect-error: a root takes a model of its registry only
h(Tree.Root, { model: createTreeModel<{ items: { other: undefined } }>() });

// the composables are typed by the registry they are given
export function composables() {
    const { model: typed } = useTree<Types>();
    typed.run("item.expand", { itemId: "a" });
    const count = useTreeState<Types, number>(
        (state) => state.rootItemIds.length,
    );
    const n: number = count.value;
    const { state } = useTreeItem<Types>(
        () => model.state.items.a as ItemOf<Types>,
    );
    const level: number = state.value.level;
    return n + level;
}
