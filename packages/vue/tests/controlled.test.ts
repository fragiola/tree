import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, reactive, ref } from "vue";
import {
    content,
    files,
    filesModel,
    fileTree,
    fire,
    itemElement,
    render,
    settle,
} from "./tree";

describe("controlled and uncontrolled state", () => {
    it("uncontrolled: a default-tree is the root's own model", async () => {
        const onExpanded = vi.fn();
        await render(() =>
            fileTree({
                defaultTree: files(),
                "onUpdate:expandedItemIds": onExpanded,
            }),
        );
        const toggle = itemElement("utils").querySelector(
            '[data-tree-part="toggle"]',
        );
        if (!toggle) throw new Error("no toggle");
        await fire(toggle, "click");
        expect(itemElement("a.ts")).toBeInTheDocument();
        expect(onExpanded).toHaveBeenCalledWith(["src", "utils"]);
    });

    it("controlled expansion: the prop drives the model through commands", async () => {
        const model = filesModel();
        const commands: string[] = [];
        model.subscribe((event) => commands.push(event.command));
        const props = reactive({ expandedItemIds: ["src"] });
        await render(() =>
            fileTree({ model, expandedItemIds: props.expandedItemIds }),
        );
        props.expandedItemIds = ["src", "utils"];
        await settle();
        expect(model.state.expandedItemIds).toEqual(["src", "utils"]);
        expect(itemElement("a.ts")).toBeInTheDocument();
        props.expandedItemIds = [];
        await settle();
        expect(model.state.expandedItemIds).toEqual([]);
        expect(commands).toEqual(["batch", "batch"]);
    });

    it("controlled expansion: a change the app does not accept is reverted", async () => {
        const model = filesModel();
        const onChange = vi.fn();
        await render(() =>
            fileTree({
                model,
                expandedItemIds: ["src"],
                "onUpdate:expandedItemIds": onChange,
            }),
        );
        model.run("item.expand", { itemId: "utils" });
        await settle();
        expect(onChange).toHaveBeenCalledWith(["src", "utils"]);
        expect(model.state.expandedItemIds).toEqual(["src"]);
        expect(() => itemElement("a.ts")).toThrow();
    });

    it("controlled selection follows the app's state (v-model)", async () => {
        const App = defineComponent({
            setup() {
                const selected = ref<string[]>(["app"]);
                return () => [
                    h(
                        "output",
                        { "data-testid": "selected" },
                        selected.value.join(","),
                    ),
                    fileTree({
                        defaultTree: files(),
                        selectedItemIds: selected.value,
                        "onUpdate:selectedItemIds": (itemIds: string[]) => {
                            selected.value = itemIds;
                        },
                    }),
                ];
            },
        });
        await render(() => h(App));
        expect(itemElement("app.ts")).toHaveAttribute("aria-selected", "true");
        await fire(content("readme.md"), "click");
        expect(
            document.querySelector('[data-testid="selected"]'),
        ).toHaveTextContent("readme");
        expect(itemElement("readme.md")).toHaveAttribute(
            "aria-selected",
            "true",
        );
        expect(itemElement("app.ts")).toHaveAttribute("aria-selected", "false");
    });

    it("controlled checks map onto item.check, in cascade", async () => {
        const model = filesModel({ expandedItemIds: ["src", "utils"] });
        const onChecked = vi.fn();
        const props = reactive({ checkedItemIds: [] as string[] });
        await render(() =>
            fileTree({
                model,
                checkedItemIds: props.checkedItemIds,
                "onUpdate:checkedItemIds": onChecked,
            }),
        );
        props.checkedItemIds = ["utils", "a", "b"];
        await settle();
        expect([...model.state.checkedItemIds].sort()).toEqual([
            "a",
            "b",
            "utils",
        ]);
        expect(itemElement("utils")).toHaveAttribute("aria-checked", "true");
        // the root's own commands are not reported back as changes
        expect(onChecked).not.toHaveBeenCalled();
    });

    it("settles a controlled parent check the model cascades, instead of fighting it", async () => {
        const model = filesModel({ expandedItemIds: ["src", "utils"] });
        let commits = 0;
        model.subscribe(() => {
            commits += 1;
        });
        await render(() => fileTree({ model, checkedItemIds: ["utils"] }));
        expect([...model.state.checkedItemIds].sort()).toEqual([
            "a",
            "b",
            "utils",
        ]);
        expect(commits).toBe(1);
    });

    it("settles a controlled selection naming an item the tree lacks", async () => {
        const model = filesModel();
        let commits = 0;
        model.subscribe(() => {
            commits += 1;
        });
        await render(() =>
            fileTree({ model, selectedItemIds: ["app", "nope"] }),
        );
        expect(model.state.selectedItemIds).toEqual(["app"]);
        expect(commits).toBe(1);
    });

    it("every change is a command its listeners see", async () => {
        const model = filesModel();
        const seen: string[] = [];
        model.subscribe((event) => seen.push(event.command));
        await render(() =>
            fileTree({ model, expandedItemIds: ["src", "utils"] }),
        );
        await fire(content("a.ts"), "click");
        expect(seen).toEqual(["batch", "item.focus", "item.select"]);
    });
});
