import { Component, signal } from "@angular/core";
import { describe, expect, it } from "vitest";
import { TREE } from "../src/public-api";
import {
    content,
    FEATURES,
    files,
    filesModel,
    fire,
    itemElement,
    render,
    renderFiles,
    settle,
} from "./tree";

const toggle = (label: string) => {
    const element = itemElement(label).querySelector(
        ':scope > [data-tree-part="content"] > [data-tree-part="toggle"]',
    );
    if (!element) throw new Error(`no toggle on ${label}`);
    return element;
};

/** The app's signals bound both ways to the root (`[(x)]`). */
@Component({
    selector: "test-bound",
    imports: [TREE],
    template: `
        <output data-testid="selected">{{ selected().join(",") }}</output>
        <output data-testid="expanded">{{ expanded().join(",") }}</output>
        <div
            treeRoot
            [defaultTree]="json"
            [features]="features"
            [(selectedItemIds)]="selected"
            [(expandedItemIds)]="expanded"
            aria-label="Files"
        >
            <ng-template treeItems let-item>
                <div [treeItem]="item">
                    <div treeItemContent>
                        <span treeToggle></span>
                        <span>{{ item.label }}</span>
                    </div>
                    <div treeGroup></div>
                </div>
            </ng-template>
        </div>
    `,
})
class Bound {
    protected readonly features = FEATURES;
    readonly json = files();
    readonly selected = signal<string[]>(["app"]);
    readonly expanded = signal<string[]>(["src"]);
}

const output = (id: string) => document.querySelector(`[data-testid="${id}"]`);

describe("controlled and uncontrolled state", () => {
    it("uncontrolled: a defaultTree is the root's own model", async () => {
        const view = await renderFiles({ defaultTree: files() });
        await fire(toggle("utils"), "click");
        expect(itemElement("a.ts")).toBeInTheDocument();
        expect(view.component.emitted).toEqual([
            ["expandedItemIds", ["src", "utils"]],
        ]);
    });

    it("controlled expansion: the input drives the model through commands", async () => {
        const model = filesModel();
        const commands: string[] = [];
        model.subscribe((event) => commands.push(event.command));
        const view = await renderFiles({ model, expandedItemIds: ["src"] });
        await view.set("expandedItemIds", ["src", "utils"]);
        expect(model.state.expandedItemIds).toEqual(["src", "utils"]);
        expect(itemElement("a.ts")).toBeInTheDocument();
        await view.set("expandedItemIds", []);
        expect(model.state.expandedItemIds).toEqual([]);
        expect(commands).toEqual(["batch", "batch"]);
    });

    it("controlled expansion: a change the app does not accept is reverted (a one-way binding)", async () => {
        const model = filesModel();
        const view = await renderFiles({ model, expandedItemIds: ["src"] });
        model.run("item.expand", { itemId: "utils" });
        await settle();
        expect(view.component.emitted).toEqual([
            ["expandedItemIds", ["src", "utils"]],
        ]);
        expect(model.state.expandedItemIds).toEqual(["src"]);
        expect(() => itemElement("a.ts")).toThrow();
    });

    it("controlled selection follows the app's signal ([(selectedItemIds)])", async () => {
        await render(Bound);
        expect(itemElement("app.ts")).toHaveAttribute("aria-selected", "true");
        await fire(content("readme.md"), "click");
        expect(output("selected")).toHaveTextContent("readme");
        expect(itemElement("readme.md")).toHaveAttribute(
            "aria-selected",
            "true",
        );
        expect(itemElement("app.ts")).toHaveAttribute("aria-selected", "false");
    });

    it("controlled expansion follows the app's signal both ways ([(expandedItemIds)])", async () => {
        const view = await render(Bound);
        await fire(toggle("utils"), "click");
        expect(output("expanded")).toHaveTextContent("src,utils");
        expect(itemElement("a.ts")).toBeInTheDocument();
        // the app's own change drives the tree
        view.component.expanded.set([]);
        await settle();
        expect(() => itemElement("app.ts")).toThrow();
        expect(output("expanded")).toHaveTextContent(/^$/);
    });

    it("controlled checks map onto item.check, in cascade", async () => {
        const model = filesModel({ expandedItemIds: ["src", "utils"] });
        const view = await renderFiles({
            model,
            checkedItemIds: [],
        });
        await view.set("checkedItemIds", ["utils", "a", "b"]);
        expect([...model.state.checkedItemIds].sort()).toEqual([
            "a",
            "b",
            "utils",
        ]);
        expect(itemElement("utils")).toHaveAttribute("aria-checked", "true");
        // the root's own commands are not reported back as changes
        expect(view.component.emitted).toEqual([]);
    });

    it("settles a controlled parent check the model cascades, instead of fighting it", async () => {
        const model = filesModel({ expandedItemIds: ["src", "utils"] });
        let commits = 0;
        model.subscribe(() => {
            commits += 1;
        });
        await renderFiles({
            model,
            checkedItemIds: ["utils"],
        });
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
        await renderFiles({ model, selectedItemIds: ["app", "nope"] });
        expect(model.state.selectedItemIds).toEqual(["app"]);
        expect(commits).toBe(1);
    });

    it("every change is a command its listeners see", async () => {
        const model = filesModel();
        const seen: string[] = [];
        model.subscribe((event) => seen.push(event.command));
        await renderFiles({ model, expandedItemIds: ["src", "utils"] });
        await fire(content("a.ts"), "click");
        expect(seen).toEqual(["batch", "item.focus", "item.select"]);
    });
});
