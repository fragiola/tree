import { act, fireEvent, render } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { content, FileTree, files, filesModel, itemElement } from "./tree";

describe("controlled and uncontrolled state", () => {
    it("uncontrolled: a defaultTree is the root's own model", () => {
        const onExpanded = vi.fn();
        render(
            <FileTree
                defaultTree={files()}
                onExpandedItemIdsChange={onExpanded}
            />,
        );
        const toggle = itemElement("utils").querySelector(
            '[data-tree-part="toggle"]',
        );
        if (!toggle) throw new Error("no toggle");
        fireEvent.click(toggle);
        expect(itemElement("a.ts")).toBeInTheDocument();
        expect(onExpanded).toHaveBeenCalledWith(["src", "utils"]);
    });

    it("controlled expansion: the prop drives the model through commands", () => {
        const model = filesModel();
        const commands: string[] = [];
        model.subscribe((event) => commands.push(event.command));
        const { rerender } = render(
            <FileTree model={model} expandedItemIds={["src"]} />,
        );
        rerender(<FileTree model={model} expandedItemIds={["src", "utils"]} />);
        expect(model.state.expandedItemIds).toEqual(["src", "utils"]);
        expect(itemElement("a.ts")).toBeInTheDocument();
        rerender(<FileTree model={model} expandedItemIds={[]} />);
        expect(model.state.expandedItemIds).toEqual([]);
        expect(commands).toEqual(["batch", "batch"]);
    });

    it("controlled expansion: a change the app does not accept is reverted", () => {
        const model = filesModel();
        const onChange = vi.fn();
        render(
            <FileTree
                model={model}
                expandedItemIds={["src"]}
                onExpandedItemIdsChange={onChange}
            />,
        );
        act(() => {
            model.run("item.expand", { itemId: "utils" });
        });
        expect(onChange).toHaveBeenCalledWith(["src", "utils"]);
        expect(model.state.expandedItemIds).toEqual(["src"]);
        expect(() => itemElement("a.ts")).toThrow();
    });

    it("controlled selection follows the app's state", () => {
        function App() {
            const [selected, setSelected] = React.useState<string[]>(["app"]);
            return (
                <>
                    <output data-testid="selected">{selected.join(",")}</output>
                    <FileTree
                        defaultTree={files()}
                        selectedItemIds={selected}
                        onSelectedItemIdsChange={setSelected}
                    />
                </>
            );
        }
        const { getByTestId } = render(<App />);
        expect(itemElement("app.ts")).toHaveAttribute("aria-selected", "true");
        fireEvent.click(content("readme.md"));
        expect(getByTestId("selected")).toHaveTextContent("readme");
        expect(itemElement("readme.md")).toHaveAttribute(
            "aria-selected",
            "true",
        );
        expect(itemElement("app.ts")).toHaveAttribute("aria-selected", "false");
    });

    it("controlled checks map onto item.check, in cascade", () => {
        const model = filesModel({ expandedItemIds: ["src", "utils"] });
        const onChecked = vi.fn();
        const { rerender } = render(
            <FileTree
                model={model}
                checkboxes
                checkedItemIds={[]}
                onCheckedItemIdsChange={onChecked}
            />,
        );
        rerender(
            <FileTree
                model={model}
                checkboxes
                checkedItemIds={["utils", "a", "b"]}
                onCheckedItemIdsChange={onChecked}
            />,
        );
        expect([...model.state.checkedItemIds].sort()).toEqual([
            "a",
            "b",
            "utils",
        ]);
        expect(itemElement("utils")).toHaveAttribute("aria-checked", "true");
        // the root's own commands are not reported back as changes
        expect(onChecked).not.toHaveBeenCalled();
    });

    it("every change is a command its listeners see", () => {
        const model = filesModel();
        const seen: string[] = [];
        model.subscribe((event) => seen.push(event.command));
        render(<FileTree model={model} expandedItemIds={["src", "utils"]} />);
        fireEvent.click(content("a.ts"));
        expect(seen).toEqual(["batch", "item.focus", "item.select"]);
    });
});
