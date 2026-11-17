// Type fixtures (checked by `tsc`, never run): the root's lists and events, the composables and the
// refs are typed by the model's features, through `typedTree<T, F>()`.
import { h } from "vue";
import {
    createTreeModel,
    typedTree,
    useTreeRef,
    useTreeState,
} from "../../src";
import { asyncChildren } from "../../src/async-children";
import { checkboxes } from "../../src/checkboxes";
import { rename } from "../../src/rename";
import { selection } from "../../src/selection";
import { typeAhead } from "../../src/type-ahead";
import { virtualization } from "../../src/virtualization";

type Types = { items: { file: undefined } };

const features = [selection(), virtualization({ rowSize: 20 })] as const;
const model = createTreeModel<Types, typeof features>(undefined, { features });
const bare = createTreeModel<Types>();

const Tree = typedTree<Types, typeof features>();
const BareTree = typedTree<Types>();

// a feature's list and event compile with its feature
h(Tree.Root, {
    model,
    selectedItemIds: [],
    "onUpdate:selectedItemIds": (itemIds: string[]) => itemIds.length,
});
// a root's props, as a template checks them: a feature's list needs its feature
type RootPropsOf<
    C extends abstract new (
        ...args: never
    ) => { $props: object },
> = InstanceType<C>["$props"];
const withSelection: RootPropsOf<typeof Tree.Root> = { selectedItemIds: [] };
void withSelection;
const withoutSelection: RootPropsOf<typeof BareTree.Root> = {
    // @ts-expect-error selectedItemIds needs the selection feature
    selectedItemIds: [],
};
void withoutSelection;

export function composables() {
    // inferred from the model
    const count = useTreeState((state) => state.selectedItemIds.length, {
        model,
    });
    const n: number = count.value;
    // @ts-expect-error a bare tree's state has no selection
    useTreeState((state) => state.selectedItemIds, { model: bare });
    const tree = useTreeRef<Types, typeof features>();
    void tree.value?.engine.get("virtual-window");
    const bareTree = useTreeRef<Types>();
    // @ts-expect-error the virtualization feature is not installed
    void bareTree.value?.engine.get("virtual-window");
    return n;
}

const stateFeatures = [
    checkboxes(),
    rename(),
    asyncChildren(),
    typeAhead(),
] as const;
const StateTree = typedTree<Types, typeof stateFeatures>();
const withChecks: RootPropsOf<typeof StateTree.Root> = {
    checkedItemIds: [],
    // the loader is typed by the registry
    loadChildren: async (item) =>
        item.kind === "file" ? [{ kind: "file", label: "x" }] : [],
};
void withChecks;
const withoutChecks: RootPropsOf<typeof BareTree.Root> = {
    // @ts-expect-error checkedItemIds needs the checkboxes feature
    checkedItemIds: [],
};
void withoutChecks;
const withoutLoader: RootPropsOf<typeof BareTree.Root> = {
    // @ts-expect-error loadChildren needs the async children feature
    loadChildren: async () => [],
};
void withoutLoader;
h(StateTree.Root, {
    checkedItemIds: [],
    "onUpdate:checkedItemIds": (itemIds: string[]) => itemIds.length,
});

export function stateComposables() {
    const tree = useTreeRef<Types, typeof stateFeatures>();
    tree.value?.engine.run("load-children", { itemId: "a" });
    const bareTree = useTreeRef<Types>();
    // @ts-expect-error the rename feature is not installed
    bareTree.value?.engine.run("commit-rename", { itemId: "a", label: "b" });
}
