import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { type RenderedProps, Tree, type TreeItemState } from "../src";
import { FEATURES, files, filesModel, itemElement } from "./tree";

/** A tree whose items are rendered with `itemProps`, and nothing else. */
function Bare(props: {
    itemProps?: (
        item: string,
    ) => Omit<React.ComponentProps<typeof Tree.Item>, "item">;
    children?: React.ReactNode;
}) {
    return (
        <Tree.Root model={filesModel()} aria-label="Files">
            <Tree.Items>
                {(item) => (
                    <Tree.Item item={item} {...props.itemProps?.(item.id)}>
                        <Tree.ItemContent />
                        <Tree.Group>
                            {(child) => (
                                <Tree.Item
                                    item={child}
                                    {...props.itemProps?.(child.id)}
                                />
                            )}
                        </Tree.Group>
                    </Tree.Item>
                )}
            </Tree.Items>
            {props.children}
        </Tree.Root>
    );
}

describe("the primitive contract", () => {
    it("renders no text and sets no aria-label of its own", () => {
        const { container } = render(
            <Tree.Root model={filesModel()}>
                <Tree.Items>
                    {(item) => (
                        <Tree.Item item={item}>
                            <Tree.ItemContent>
                                <Tree.Toggle />
                            </Tree.ItemContent>
                            <Tree.Group>
                                {(child) => <Tree.Item item={child} />}
                            </Tree.Group>
                        </Tree.Item>
                    )}
                </Tree.Items>
                <Tree.DropIndicator />
                <Tree.LiveRegion />
            </Tree.Root>,
        );
        expect(container.textContent).toBe("");
        expect(container.querySelector("[aria-label]")).toBeNull();
        expect(container.querySelector("[aria-labelledby]")).toBeNull();
        expect(container.querySelector("style, link, svg, img")).toBeNull();
    });

    it("replaces the element with a render element, merging the props", () => {
        render(
            <Bare
                itemProps={(id) => ({
                    render: <li data-testid={`li-${id}`} />,
                })}
            />,
        );
        const li = screen.getByTestId("li-src");
        expect(li.tagName).toBe("LI");
        expect(li).toHaveAttribute("role", "treeitem");
        expect(li).toHaveAttribute("data-tree-path", "/0");
    });

    it("calls a render function with the props and the state", () => {
        const seen: TreeItemState[] = [];
        render(
            <Bare
                itemProps={() => ({
                    render: (props: RenderedProps, state: TreeItemState) => {
                        seen.push(state);
                        return <section {...props} />;
                    },
                })}
            />,
        );
        expect(itemElement).toBeDefined();
        const sections = document.querySelectorAll("section[role=treeitem]");
        expect(sections.length).toBe(5);
        const src = seen.find((state) => state.itemId === "src");
        expect(src).toMatchObject({ expanded: true, level: 1, path: "/0" });
    });

    it("merges a ref given as a plain prop with its own", () => {
        const ref = React.createRef<HTMLElement>();
        render(<Bare itemProps={(id) => (id === "src" ? { ref } : {})} />);
        expect(ref.current).toHaveAttribute("data-tree-path", "/0");
    });

    it("forwards arbitrary props and composes handlers, its own first", () => {
        const calls: string[] = [];
        const model = filesModel();
        model.subscribe((event) => calls.push(event.command));
        render(
            <Tree.Root model={model} aria-label="Files">
                <Tree.Items>
                    {(item) => (
                        <Tree.Item item={item}>
                            <Tree.ItemContent
                                id={`row-${item.id}`}
                                title="row"
                                onClick={() => calls.push("consumer")}
                            />
                        </Tree.Item>
                    )}
                </Tree.Items>
            </Tree.Root>,
        );
        const row = document.getElementById("row-readme");
        expect(row).toHaveAttribute("title", "row");
        if (!row) throw new Error("no row");
        fireEvent.click(row);
        expect(calls).toEqual(["item.focus", "item.select", "consumer"]);
    });

    it("takes className and style as values or functions of the state", () => {
        render(
            <Bare
                itemProps={() => ({
                    className: (state) => (state.expanded ? "open" : "closed"),
                    style: (state) => ({ opacity: state.leaf ? 0.5 : 1 }),
                })}
            />,
        );
        expect(itemElement).toBeDefined();
        const src = document.querySelector('[data-tree-path="/0"]');
        const readme = document.querySelector('[data-tree-path="/1"]');
        expect(src).toHaveClass("open");
        expect(readme).toHaveClass("closed");
        expect(readme).toHaveStyle({ opacity: "0.5" });
    });

    it("keeps its structural style over the consumer's", () => {
        render(
            <Bare
                itemProps={() => ({
                    style: { "--tree-depth": 9, color: "red" } as never,
                })}
            />,
        );
        const app = document.querySelector('[data-tree-path="/0/0"]');
        if (!(app instanceof HTMLElement)) throw new Error("no app");
        expect(app.style.getPropertyValue("--tree-depth")).toBe("1");
        expect(app.style.color).toBe("red");
    });

    it("sets boolean data attributes present or absent, never false", () => {
        render(<Bare />);
        const readme = document.querySelector('[data-tree-path="/1"]');
        expect(readme).toHaveAttribute("data-leaf", "");
        expect(readme).not.toHaveAttribute("data-expanded");
        const all = [...document.querySelectorAll("*")].flatMap((element) =>
            [...element.attributes].filter(
                (attribute) =>
                    attribute.name.startsWith("data-") &&
                    attribute.value === "false",
            ),
        );
        expect(all).toEqual([]);
    });

    it("needs no Provider, and says where a part must be rendered", () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() =>
            render(<Tree.Item item={filesModel().state.items.src as never} />),
        ).toThrow("Tree.Item must be rendered inside Tree.Root");
        expect(() =>
            render(
                <Tree.Root defaultTree={files()} features={FEATURES}>
                    <Tree.Toggle />
                </Tree.Root>,
            ),
        ).toThrow("Tree.Toggle must be rendered inside Tree.Item");
        error.mockRestore();
    });
});
