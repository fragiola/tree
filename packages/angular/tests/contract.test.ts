// The primitive contract, in Angular: a directive goes on the app's element, so `as` (another
// element) is the app's own tag, the render slot is a template reference to the part
// (`#node="treeItem"`, `node.state()`), and `class`/`style` are the element's own attributes and
// bindings.
import { Component, input, type Type, viewChildren } from "@angular/core";
import { describe, expect, it, vi } from "vitest";
import {
    type ItemOf,
    TREE,
    type TreeItemDirective,
    type TreeModel,
} from "../src/public-api";
import {
    type FileTypes,
    files,
    filesModel,
    fire,
    render,
    renderFiles,
    settle,
} from "./tree";

type Child = ItemOf<FileTypes>;

/** Every part, and no text, no label. */
@Component({
    selector: "test-bare",
    imports: [TREE],
    template: `
        <div [treeRoot]="model()">
            <ng-template treeItems let-item>
                <div [treeItem]="item">
                    <div treeItemContent>
                        <span treeToggle></span>
                    </div>
                    <div treeGroup></div>
                </div>
            </ng-template>
            <div treeDropIndicator></div>
            <div treeLiveRegion></div>
        </div>
    `,
})
class Bare {
    readonly model = input(filesModel());
}

/** The items on `<ul>`/`<li>`, with the app's attributes, class and style. */
@Component({
    selector: "test-list",
    imports: [TREE],
    template: `
        <ul [treeRoot]="model()" aria-label="Files">
            <ng-template treeItems let-item>
                <li
                    [treeItem]="item"
                    #node="treeItem"
                    class="item"
                    [class.open]="node.state().expanded"
                    [class.closed]="!node.state().expanded"
                    style="opacity: 0.5; --tree-depth: 9; color: red"
                    [attr.data-testid]="'li-' + item.id"
                >
                    <div treeItemContent [id]="'row-' + item.id" title="row" (click)="clicked()"></div>
                    <ul treeGroup style="display: block; margin: 0"></ul>
                </li>
            </ng-template>
        </ul>
    `,
})
class List {
    readonly model = input(filesModel());
    readonly nodes = viewChildren<TreeItemDirective<FileTypes>>("node");
    readonly calls: string[] = [];

    clicked(): void {
        this.calls.push("consumer");
    }
}

/** A part outside the element it needs. */
@Component({
    selector: "test-item-outside",
    imports: [TREE],
    template: `<div [treeItem]="item()"></div>`,
})
class ItemOutside {
    readonly item = input(filesModel().get("item-by", { id: "src" }) as Child);
}

@Component({
    selector: "test-toggle-outside",
    imports: [TREE],
    template: `<div treeRoot [defaultTree]="json"><span treeToggle></span></div>`,
})
class ToggleOutside {
    readonly json = files();
}

/** The `[class]` binding reads the part's state on the element the part is on. */
@Component({
    selector: "test-class-binding",
    imports: [TREE],
    template: `
        <div [treeRoot]="model()">
            <ng-template treeItems let-item>
                <div
                    [treeItem]="item"
                    #node="treeItem"
                    [class]="node.state().selected ? 'row selected' : 'row'"
                    [style.padding-inline-start.px]="node.state().level * 8"
                ></div>
            </ng-template>
        </div>
    `,
})
class ClassBinding {
    readonly model = input.required<TreeModel<FileTypes>>();
}

describe("the primitive contract", () => {
    it("renders no text and sets no aria-label of its own", async () => {
        const view = await render(Bare);
        const element = view.element;
        expect(element.querySelectorAll('[role="treeitem"]').length).toBe(5);
        expect(element.textContent).toBe("");
        expect(element.querySelector("[aria-label]")).toBeNull();
        expect(element.querySelector("[aria-labelledby]")).toBeNull();
        expect(element.querySelector("style, link, svg, img")).toBeNull();
    });

    it("goes on the app's element, whatever its tag (in place of `as`)", async () => {
        await render(List);
        const tree = document.querySelector('[role="tree"]');
        expect(tree?.tagName).toBe("UL");
        const li = document.querySelector('[data-testid="li-src"]');
        expect(li?.tagName).toBe("LI");
        expect(li).toHaveAttribute("role", "treeitem");
        expect(li).toHaveAttribute("data-tree-path", "/0");
        expect(li?.querySelector('[role="group"]')?.tagName).toBe("UL");
    });

    it("gives a template reference the part, with its state (in place of the render slot)", async () => {
        const view = await render(List);
        // the root items' views; a group's children are rendered by the group, out of the query
        const nodes = view.component.nodes();
        const src = nodes.find((node) => node.state().itemId === "src");
        expect(src?.state()).toMatchObject({
            expanded: true,
            level: 1,
            path: "/0",
        });
        expect(src?.item().id).toBe("src");
    });

    it("forwards arbitrary attributes and composes listeners, its own first", async () => {
        const model = filesModel();
        const view = await render(List, { model });
        model.subscribe((event) => view.component.calls.push(event.command));
        const row = document.getElementById("row-readme");
        expect(row).toHaveAttribute("title", "row");
        if (!row) throw new Error("no row");
        await fire(row, "click");
        expect(view.component.calls).toEqual([
            "item.focus",
            "item.select",
            "consumer",
        ]);
    });

    it("takes class and style attributes, and state looks through data-* or the part's state", async () => {
        await render(List);
        const src = document.querySelector('[data-tree-path="/0"]');
        const readme = document.querySelector('[data-tree-path="/1"]');
        expect(src).toHaveClass("item", "open");
        expect(readme).toHaveClass("item", "closed");
        expect(readme).toHaveStyle({ opacity: "0.5" });
    });

    it("keeps its structural style over the consumer's static style, leaving its other keys", async () => {
        await render(List);
        const app = document.querySelector('[data-tree-path="/0/0"]');
        if (!(app instanceof HTMLElement)) throw new Error("no app");
        expect(app.style.getPropertyValue("--tree-depth")).toBe("1");
        expect(app.style.color).toBe("red");
        expect(app.style.opacity).toBe("0.5");
        // a collapsed group: `display: none` over the app's `display: block`, its margin kept;
        // once expanded, the app's display is back
        const utils = document.querySelector<HTMLElement>(
            '[data-tree-path="/0/2"] > [role="group"]',
        );
        expect(utils?.style.display).toBe("none");
        expect(utils?.style.margin).toBe("0px");
        const src = document.querySelector<HTMLElement>(
            '[data-tree-path="/0"] > [role="group"]',
        );
        expect(src?.style.display).toBe("block");
    });

    it("gives the app's display back to a group once its item expands", async () => {
        const model = filesModel();
        await render(List, { model });
        model.run("item.expand", { itemId: "utils" });
        await settle();
        const utils = document.querySelector<HTMLElement>(
            '[data-tree-path="/0/2"] > [role="group"]',
        );
        expect(utils?.style.display).toBe("block");
        expect(utils?.style.getPropertyValue("--tree-depth")).toBe("1");
    });

    it("lets a [class] binding on the part's element read its state", async () => {
        const model = filesModel({ selectedItemIds: ["readme"] });
        await render(ClassBinding, { model });
        const readme = document.querySelector('[data-tree-path="/1"]');
        const src = document.querySelector('[data-tree-path="/0"]');
        expect(readme).toHaveClass("row", "selected");
        expect(src).toHaveClass("row");
        expect(src).not.toHaveClass("selected");
        expect(readme).toHaveStyle({ paddingInlineStart: "8px" });
        model.run("tree.select", { itemIds: ["src"] });
        await settle();
        expect(src).toHaveClass("row", "selected");
        expect(readme).not.toHaveClass("selected");
        // the binding's class and the structural style live together
        expect(
            (src as HTMLElement).style.getPropertyValue("--tree-depth"),
        ).toBe("0");
    });

    it("sets boolean data attributes present or absent, never false", async () => {
        await renderFiles({ model: filesModel() });
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

    it("needs no provider, and says where a part must be used", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const thrown = (type: Type<unknown>) =>
            render(type).then(
                () => "",
                (reason: unknown) => String(reason),
            );
        expect(await thrown(ItemOutside)).toContain(
            "[treeItem] must be used inside [treeRoot]",
        );
        expect(await thrown(ToggleOutside)).toContain(
            "[treeToggle] must be used inside [treeItem]",
        );
        error.mockRestore();
    });
});
