import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref, type VNode } from "vue";
import type { ItemOf, RenderSlotProps, TreeItemState } from "../src";
import {
    bareFiles,
    type FileTypes,
    filesModel,
    fire,
    itemElement,
    render,
    Tree,
} from "./tree";

type Child = ItemOf<FileTypes>;

/** A tree whose items get `itemAttrs` and `itemSlots`, and nothing else. */
function bare(
    itemAttrs: (id: string) => Record<string, unknown> = () => ({}),
    itemSlots: Record<string, unknown> = {},
) {
    return h(Tree.Root, { model: filesModel(), "aria-label": "Files" }, () =>
        h(Tree.Items, null, {
            default: ({ item }: { item: Child }) => [
                h(
                    Tree.Item,
                    { item, ...itemAttrs(item.id) },
                    {
                        ...itemSlots,
                        default: () => [
                            h(Tree.ItemContent),
                            h(Tree.Group, null, {
                                default: ({ item: child }: { item: Child }) => [
                                    h(
                                        Tree.Item,
                                        { item: child, ...itemAttrs(child.id) },
                                        itemSlots,
                                    ),
                                ],
                            }),
                        ],
                    },
                ),
            ],
        }),
    );
}

describe("the primitive contract", () => {
    it("renders no text and sets no aria-label of its own", async () => {
        const wrapper = await render(() =>
            h(Tree.Root, { model: filesModel() }, () => [
                h(Tree.Items, null, {
                    default: ({ item }: { item: Child }) => [
                        h(Tree.Item, { item }, () => [
                            h(Tree.ItemContent, null, () => [h(Tree.Toggle)]),
                            h(Tree.Group, null, {
                                default: ({ item: child }: { item: Child }) => [
                                    h(Tree.Item, { item: child }),
                                ],
                            }),
                        ]),
                    ],
                }),
                h(Tree.DropIndicator),
                h(Tree.LiveRegion),
            ]),
        );
        const element = wrapper.element.parentElement as HTMLElement;
        expect(element.textContent).toBe("");
        expect(element.querySelector("[aria-label]")).toBeNull();
        expect(element.querySelector("[aria-labelledby]")).toBeNull();
        expect(element.querySelector("style, link, svg, img")).toBeNull();
    });

    it("replaces the element with `as`, merging the props", async () => {
        await render(() =>
            bare((id) => ({ as: "li", "data-testid": `li-${id}` })),
        );
        const li = document.querySelector('[data-testid="li-src"]');
        expect(li?.tagName).toBe("LI");
        expect(li).toHaveAttribute("role", "treeitem");
        expect(li).toHaveAttribute("data-tree-path", "/0");
    });

    it("calls the render slot with the props and the state", async () => {
        const seen: TreeItemState[] = [];
        await render(() =>
            bare(undefined, {
                render: ({
                    props,
                    state,
                    children,
                }: RenderSlotProps<TreeItemState>) => {
                    seen.push(state);
                    return [h("section", props, [h(children)])];
                },
            }),
        );
        const sections = document.querySelectorAll("section[role=treeitem]");
        expect(sections.length).toBe(5);
        const src = seen.find((state) => state.itemId === "src");
        expect(src).toMatchObject({ expanded: true, level: 1, path: "/0" });
        // the content goes inside the element the slot renders
        expect(
            sections[0]?.querySelector('[data-tree-part="content"]'),
        ).not.toBeNull();
    });

    it("gives a template ref the part's instance, its element as $el", async () => {
        const element = ref<{ $el: HTMLElement } | null>(null);
        const App = defineComponent({
            setup() {
                return () =>
                    bare((id) => (id === "src" ? { ref: element } : {}));
            },
        });
        await render(() => h(App));
        expect(element.value?.$el).toHaveAttribute("data-tree-path", "/0");
    });

    it("forwards arbitrary attributes and composes listeners, its own first", async () => {
        const calls: string[] = [];
        const model = filesModel();
        model.subscribe((event) => calls.push(event.command));
        await render(() =>
            h(Tree.Root, { model, "aria-label": "Files" }, () =>
                h(Tree.Items, null, {
                    default: ({ item }: { item: Child }) => [
                        h(Tree.Item, { item }, () =>
                            h(Tree.ItemContent, {
                                id: `row-${item.id}`,
                                title: "row",
                                onClick: () => calls.push("consumer"),
                            }),
                        ),
                    ],
                }),
            ),
        );
        const row = document.getElementById("row-readme");
        expect(row).toHaveAttribute("title", "row");
        if (!row) throw new Error("no row");
        await fire(row, "click");
        expect(calls).toEqual(["item.focus", "item.select", "consumer"]);
    });

    it("takes class and style attributes, and state looks through data-* or the render slot", async () => {
        await render(() =>
            bare(() => ({ class: "item", style: { opacity: "0.5" } }), {
                render: ({
                    props,
                    state,
                    children,
                }: RenderSlotProps<TreeItemState>) => [
                    h(
                        "div",
                        {
                            ...props,
                            class: [
                                props.class,
                                state.expanded ? "open" : "closed",
                            ],
                        },
                        [h(children)],
                    ),
                ],
            }),
        );
        const src = document.querySelector('[data-tree-path="/0"]');
        const readme = document.querySelector('[data-tree-path="/1"]');
        expect(src).toHaveClass("item", "open");
        expect(readme).toHaveClass("item", "closed");
        expect(readme).toHaveStyle({ opacity: "0.5" });
    });

    it("keeps its structural style over the consumer's", async () => {
        await render(() =>
            bare(() => ({ style: { "--tree-depth": "9", color: "red" } })),
        );
        const app = document.querySelector('[data-tree-path="/0/0"]');
        if (!(app instanceof HTMLElement)) throw new Error("no app");
        expect(app.style.getPropertyValue("--tree-depth")).toBe("1");
        expect(app.style.color).toBe("red");
    });

    it("sets boolean data attributes present or absent, never false", async () => {
        await render(() => bare());
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

    it("needs no provider, and says where a part must be rendered", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        await expect(
            render(() =>
                h(Tree.Item, {
                    item: filesModel().state.items.src as Child,
                }),
            ),
        ).rejects.toThrow("Tree.Item must be rendered inside Tree.Root");
        await expect(
            render(() =>
                h(Tree.Root, { defaultTree: bareFiles() }, () =>
                    h(Tree.Toggle),
                ),
            ),
        ).rejects.toThrow("Tree.Toggle must be rendered inside Tree.Item");
        warn.mockRestore();
    });

    it("renders the content of the render slot's children once, as one stable node", async () => {
        const nodes: VNode[] = [];
        await render(() =>
            bare(undefined, {
                render: ({
                    props,
                    children,
                }: RenderSlotProps<TreeItemState>) => {
                    nodes.push(children);
                    return [h("div", props, [h(children)])];
                },
            }),
        );
        expect(itemElement).toBeDefined();
        expect(new Set(nodes.map((node) => node.type)).size).toBe(1);
    });
});
