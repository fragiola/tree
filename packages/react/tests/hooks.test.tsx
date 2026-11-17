import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
    createTreeRef,
    type ItemOf,
    Tree,
    useTree,
    useTreeItem,
    useTreeRef,
    useTreeState,
} from "../src";
import { FileTree, type FileTypes, files, filesModel } from "./tree";

describe("the hooks", () => {
    it("useTree gives the root's model and its engine", () => {
        let seen: ReturnType<typeof useTree<FileTypes>> | undefined;
        function Probe() {
            seen = useTree<FileTypes>();
            return null;
        }
        const model = filesModel();
        render(
            <Tree.Root model={model}>
                <Probe />
            </Tree.Root>,
        );
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

    it("useTreeState re-renders with the selection it selects", () => {
        function Count() {
            const count = useTreeState<FileTypes, number>(
                (state) => state.selectedItemIds.length,
            );
            return <output data-testid="count">{count}</output>;
        }
        const model = filesModel({ settings: { selectionMode: "multiple" } });
        render(
            <Tree.Root model={model}>
                <Count />
            </Tree.Root>,
        );
        expect(screen.getByTestId("count")).toHaveTextContent("0");
        act(() => {
            model.run("tree.select", { itemIds: ["app", "readme"] });
        });
        expect(screen.getByTestId("count")).toHaveTextContent("2");
    });

    it("useTreeState reads a model given to it, outside any root", () => {
        const model = filesModel();
        function Expanded() {
            const ids = useTreeState(
                (state) => state.expandedItemIds.join(","),
                { model },
            );
            return <output data-testid="expanded">{ids}</output>;
        }
        render(<Expanded />);
        act(() => {
            model.run("item.expand", { itemId: "utils" });
        });
        expect(screen.getByTestId("expanded")).toHaveTextContent("src,utils");
    });

    it("useTreeItem builds an item on any element", () => {
        function Row({ item }: { item: ItemOf<FileTypes> }) {
            const { state, props } = useTreeItem<FileTypes>(item);
            return (
                <li {...props} data-testid={item.id}>
                    {state.expanded ? "open" : "shut"}
                </li>
            );
        }
        render(
            <Tree.Root model={filesModel()} aria-label="Files">
                <Tree.Items<FileTypes>>
                    {(item) => <Row item={item} />}
                </Tree.Items>
            </Tree.Root>,
        );
        const src = screen.getByTestId("src");
        expect(src).toHaveAttribute("role", "treeitem");
        expect(src).toHaveAttribute("data-tree-path", "/0");
        expect(src).toHaveTextContent("open");
    });

    it("useTreeRef reaches the root from outside it, and re-renders when it mounts", () => {
        function App() {
            const tree = useTreeRef<FileTypes>();
            return (
                <>
                    <button
                        type="button"
                        disabled={tree.current === null}
                        onClick={() =>
                            tree.current?.model.run("tree.collapse-all", {})
                        }
                    >
                        Collapse all
                    </button>
                    <FileTree treeRef={tree} defaultTree={files()} />
                </>
            );
        }
        render(<App />);
        const button = screen.getByRole("button", { name: "Collapse all" });
        expect(button).toBeEnabled();
        expect(screen.getAllByRole("treeitem")).toHaveLength(5);
        fireEvent.click(button);
        expect(screen.getAllByRole("treeitem")).toHaveLength(2);
    });

    it("createTreeRef attaches while the root is mounted, and detaches after", () => {
        const tree = createTreeRef<FileTypes>();
        const model = filesModel();
        const { unmount } = render(<FileTree treeRef={tree} model={model} />);
        expect(tree.current?.model).toBe(model);
        expect(tree.current?.engine.can("focus", { itemId: "app" })).toBe(true);
        unmount();
        expect(tree.current).toBeNull();
    });
});
