import { describe, expect, it } from "vitest";
import { defineComponent, h, type PropType, ref } from "vue";
import {
    createTreeRef,
    type ItemOf,
    type TreeStateOf,
    type UseTreeResult,
    useTree,
    useTreeItem,
    useTreeRef,
    useTreeState,
} from "../src";
import {
    type FEATURES,
    type FileTypes,
    files,
    filesModel,
    fileTree,
    fire,
    render,
    settle,
    Tree,
} from "./tree";

const items = () => document.querySelectorAll('[role="treeitem"]');
const testId = (id: string) => document.querySelector(`[data-testid="${id}"]`);

describe("the composables", () => {
    it("useTree gives the root's model and its engine", async () => {
        let seen: UseTreeResult<FileTypes> | undefined;
        const Probe = defineComponent({
            setup() {
                seen = useTree<FileTypes>();
                return () => null;
            },
        });
        const model = filesModel();
        await render(() => h(Tree.Root, { model }, () => h(Probe)));
        expect(seen?.model).toBe(model);
        expect(seen?.engine.get("direction")).toBe("ltr");
        expect(Object.keys(seen?.engine ?? {}).sort()).toEqual([
            "adapter",
            "can",
            "check",
            "destroy",
            "get",
            "is",
            "run",
            "subscribe",
        ]);
    });

    it("useTreeState changes with the selection it selects", async () => {
        const Count = defineComponent({
            setup() {
                const count = useTreeState<FileTypes, number>(
                    (state) =>
                        (state as TreeStateOf<FileTypes, typeof FEATURES>)
                            .selectedItemIds.length,
                );
                return () =>
                    h("output", { "data-testid": "count" }, count.value);
            },
        });
        const model = filesModel({ settings: { selectionMode: "multiple" } });
        await render(() => h(Tree.Root, { model }, () => h(Count)));
        expect(testId("count")).toHaveTextContent("0");
        model.run("tree.select", { itemIds: ["app", "readme"] });
        await settle();
        expect(testId("count")).toHaveTextContent("2");
    });

    it("useTreeState reads a model given to it, outside any root", async () => {
        const model = filesModel();
        const Expanded = defineComponent({
            setup() {
                const ids = useTreeState(
                    (state) => state.expandedItemIds.join(","),
                    { model },
                );
                return () =>
                    h("output", { "data-testid": "expanded" }, ids.value);
            },
        });
        await render(() => h(Expanded));
        model.run("item.expand", { itemId: "utils" });
        await settle();
        expect(testId("expanded")).toHaveTextContent("src,utils");
    });

    it("useTreeItem builds an item on any element", async () => {
        const Row = defineComponent({
            props: {
                item: {
                    type: Object as PropType<ItemOf<FileTypes>>,
                    required: true,
                },
            },
            setup(props) {
                const { state, props: itemProps } = useTreeItem<FileTypes>(
                    () => props.item,
                );
                return () =>
                    h(
                        "li",
                        { ...itemProps.value, "data-testid": props.item.id },
                        state.value.expanded ? "open" : "shut",
                    );
            },
        });
        await render(() =>
            h(Tree.Root, { model: filesModel(), "aria-label": "Files" }, () =>
                h(Tree.Items, null, {
                    default: ({ item }: { item: ItemOf<FileTypes> }) => [
                        h(Row, { item }),
                    ],
                }),
            ),
        );
        const src = testId("src");
        expect(src).toHaveAttribute("role", "treeitem");
        expect(src).toHaveAttribute("data-tree-path", "/0");
        expect(src).toHaveTextContent("open");
    });

    it("useTreeRef reaches the root from outside it, and re-renders when it mounts", async () => {
        const App = defineComponent({
            setup() {
                const tree = useTreeRef<FileTypes>();
                return () => [
                    h(
                        "button",
                        {
                            type: "button",
                            disabled: tree.value === null,
                            onClick: () =>
                                tree.value?.model.run("tree.collapse-all", {}),
                        },
                        "Collapse all",
                    ),
                    fileTree({ treeRef: tree, defaultTree: files() }),
                ];
            },
        });
        await render(() => h(App));
        const button = document.querySelector("button");
        if (!button) throw new Error("no button");
        expect(button).toBeEnabled();
        expect(items()).toHaveLength(5);
        await fire(button, "click");
        expect(items()).toHaveLength(2);
    });

    it("createTreeRef attaches while the root is mounted, and detaches after", async () => {
        const tree = createTreeRef<FileTypes>();
        const model = filesModel();
        const wrapper = await render(() => fileTree({ treeRef: tree, model }));
        expect(tree.value?.model).toBe(model);
        expect(tree.value?.engine.can("focus", { itemId: "app" })).toBe(true);
        wrapper.unmount();
        expect(tree.value).toBeNull();
    });

    it("useTreeState selects again when a reactive value its selector reads changes", async () => {
        const model = filesModel();
        const id = ref("app");
        const Label = defineComponent({
            setup() {
                const label = useTreeState(
                    (state) => state.items[id.value]?.label,
                    { model },
                );
                return () =>
                    h("output", { "data-testid": "label" }, label.value);
            },
        });
        await render(() => h(Label));
        expect(testId("label")).toHaveTextContent("app.ts");
        id.value = "readme";
        await settle();
        expect(testId("label")).toHaveTextContent("readme.md");
    });
});
