// The injection functions (React's hooks, Vue's composables), and the root's handle
// (`#tree="treeRoot"`), which replaces the tree refs: a template reaches the root's `model()` and
// `engine` from outside it.
import { Component, input, signal, viewChild } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { describe, expect, it, vi } from "vitest";
import {
    type CommandResult,
    createTreeModel,
    type InjectTreeItemResult,
    type InjectTreeResult,
    injectTree,
    injectTreeItem,
    injectTreeState,
    TREE,
    type TreeItemJson,
    type TreeModel,
    type TreeRootDirective,
} from "../src/public-api";
import {
    type FileTypes,
    files,
    filesModel,
    fire,
    focus,
    itemElement,
    items,
    press,
    render,
    renderFiles,
    settle,
} from "./tree";

const testId = (id: string) => document.querySelector(`[data-testid="${id}"]`);

let seen: InjectTreeResult<FileTypes> | undefined;
let before: CommandResult<unknown> | undefined;

/** Keeps what `injectTree` gave it, and what its engine answered before the root created one. */
@Component({ selector: "test-probe", template: "" })
class Probe {
    constructor() {
        seen = injectTree<FileTypes>();
        before = seen.engine.run("focus", { itemId: "app" });
    }
}

@Component({
    selector: "test-with-probe",
    imports: [TREE, Probe],
    template: `<div [treeRoot]="model()"><test-probe /></div>`,
})
class WithProbe {
    readonly model = input.required<TreeModel<FileTypes>>();
}

@Component({
    selector: "test-count",
    template: `<output data-testid="count">{{ count() }}</output>`,
})
class Count {
    readonly count = injectTreeState<FileTypes, number>(
        (state) => state.selectedItemIds.length,
    );
}

@Component({
    selector: "test-with-count",
    imports: [TREE, Count],
    template: `<div [treeRoot]="model()"><test-count /></div>`,
})
class WithCount {
    readonly model = input.required<TreeModel<FileTypes>>();
}

/** Reads a model it is given (a signal), anywhere. */
@Component({
    selector: "test-expanded",
    template: `<output data-testid="expanded">{{ ids() }}</output>`,
})
class Expanded {
    readonly model = input.required<TreeModel<FileTypes>>();
    readonly ids = injectTreeState((state) => state.expandedItemIds.join(","), {
        model: this.model,
    });
}

/** A label selected by an id the component holds in a signal. */
@Component({
    selector: "test-label",
    template: `<output data-testid="label">{{ label() }}</output>`,
})
class Label {
    readonly model = input.required<TreeModel<FileTypes>>();
    readonly itemId = signal("app");
    readonly label = injectTreeState(
        (state) => state.items[this.itemId()]?.label,
        { model: this.model },
    );
}

/** A component inside an item: its open or shut state, from `injectTreeItem`. */
@Component({
    selector: "test-row-state",
    template: `<span [attr.data-testid]="'state-' + item.item().id">{{ item.state().expanded ? "open" : "shut" }}</span>`,
})
class RowState {
    readonly item: InjectTreeItemResult<FileTypes> =
        injectTreeItem<FileTypes>();
}

@Component({
    selector: "test-with-rows",
    imports: [TREE, RowState],
    template: `
        <div [treeRoot]="model()" aria-label="Files">
            <ng-template treeItems let-item>
                <div [treeItem]="item"><test-row-state /></div>
            </ng-template>
        </div>
    `,
})
class WithRows {
    readonly model = input.required<TreeModel<FileTypes>>();
}

@Component({
    selector: "test-row-outside",
    imports: [TREE, RowState],
    template: `<div treeRoot [defaultTree]="json"><test-row-state /></div>`,
})
class RowOutside {
    readonly json = files();
}

/** A button outside the root, reaching it through its handle. */
@Component({
    selector: "test-handle",
    imports: [TREE],
    template: `
        <button type="button" (click)="tree.model().run('tree.collapse-all', {})">Collapse all</button>
        <div treeRoot #tree="treeRoot" [defaultTree]="json" aria-label="Files">
            <ng-template treeItems let-item>
                <div [treeItem]="item">
                    <div treeItemContent>{{ item.label }}</div>
                    <div treeGroup></div>
                </div>
            </ng-template>
        </div>
    `,
})
class Handle {
    readonly json = files();
    readonly tree = viewChild.required<TreeRootDirective<FileTypes>>("tree");
}

describe("injectTree", () => {
    it("gives the root's model and its engine", async () => {
        const model = filesModel();
        await render(WithProbe, { model });
        expect(seen?.model()).toBe(model);
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
        expect(seen?.engine.can("focus", { itemId: "app" })).toBe(true);
    });

    it("gives an engine that refuses an action before the root created its own", async () => {
        await render(WithProbe, { model: filesModel() });
        expect(before).toMatchObject({ ok: false, error: { code: "refused" } });
    });

    it("gives the root's new model when the root is given another", async () => {
        const first = filesModel();
        const view = await render(WithProbe, { model: first });
        const engine = seen?.engine;
        const second = filesModel({ expandedItemIds: [] });
        await view.set("model", second);
        expect(seen?.model()).toBe(second);
        // the same engine object, forwarding to the new engine
        expect(seen?.engine).toBe(engine);
    });

    it("must be called inside [treeRoot]", () => {
        expect(() => TestBed.runInInjectionContext(() => injectTree())).toThrow(
            "injectTree must be used inside [treeRoot]",
        );
    });
});

describe("injectTreeState", () => {
    it("changes with the selection it selects", async () => {
        const model = filesModel({ settings: { selectionMode: "multiple" } });
        await render(WithCount, { model });
        expect(testId("count")).toHaveTextContent("0");
        model.run("tree.select", { itemIds: ["app", "readme"] });
        await settle();
        expect(testId("count")).toHaveTextContent("2");
    });

    it("reads a model given to it, outside any root", async () => {
        const model = filesModel();
        await render(Expanded, { model });
        expect(testId("expanded")).toHaveTextContent("src");
        model.run("item.expand", { itemId: "utils" });
        await settle();
        expect(testId("expanded")).toHaveTextContent("src,utils");
    });

    it("reads another model when its model signal changes", async () => {
        const view = await render(Expanded, { model: filesModel() });
        await view.set("model", filesModel({ expandedItemIds: ["utils"] }));
        expect(testId("expanded")).toHaveTextContent("utils");
    });

    it("selects again when a signal its selector reads changes", async () => {
        const view = await render(Label, { model: filesModel() });
        expect(testId("label")).toHaveTextContent("app.ts");
        view.component.itemId.set("readme");
        await settle();
        expect(testId("label")).toHaveTextContent("readme.md");
    });

    it("notifies its readers only when the selection changes (isEqual)", async () => {
        const model = filesModel({ settings: { selectionMode: "multiple" } });
        const selected = TestBed.runInInjectionContext(() =>
            injectTreeState((state) => [...state.selectedItemIds], {
                model,
                isEqual: (a, b) => a.join() === b.join(),
            }),
        );
        const first = selected();
        model.run("item.expand", { itemId: "utils" });
        await settle();
        // nothing it selects changed: the same array
        expect(selected()).toBe(first);
        model.run("tree.select", { itemIds: ["app"] });
        await settle();
        expect(selected()).toEqual(["app"]);
    });

    it("must be called inside [treeRoot], or be given a model", () => {
        expect(() =>
            TestBed.runInInjectionContext(() => injectTreeState(() => 1)()),
        ).toThrow(
            "injectTreeState must be used inside [treeRoot], or be given a model",
        );
    });
});

describe("injectTreeItem", () => {
    it("gives a component inside an item its item and state", async () => {
        const model = filesModel();
        await render(WithRows, { model });
        expect(testId("state-src")).toHaveTextContent("open");
        expect(testId("state-readme")).toHaveTextContent("shut");
        model.run("item.collapse", { itemId: "src" });
        await settle();
        expect(testId("state-src")).toHaveTextContent("shut");
    });

    it("must be called inside [treeItem]", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const thrown = await render(RowOutside).then(
            () => "",
            (reason: unknown) => String(reason),
        );
        expect(thrown).toContain(
            "injectTreeItem must be used inside [treeItem]",
        );
        error.mockRestore();
    });
});

describe('the root\'s handle (#tree="treeRoot")', () => {
    it("reaches the root from outside it, in the same template", async () => {
        const view = await render(Handle);
        const button = document.querySelector("button");
        if (!button) throw new Error("no button");
        expect(items()).toHaveLength(5);
        await fire(button, "click");
        expect(items()).toHaveLength(2);
        // the model it made from defaultTree, kept
        const model = view.component.tree().model();
        expect(model.state.expandedItemIds).toEqual([]);
        expect(view.component.tree().model()).toBe(model);
    });

    it("gives the model and the engine while the root lives, and refuses after", async () => {
        const model = filesModel();
        const view = await renderFiles({ model });
        const root = view.component.root();
        expect(root.model()).toBe(model);
        expect(root.engine.can("focus", { itemId: "app" })).toBe(true);
        expect(root.state()).toMatchObject({
            multiselectable: false,
            dragging: false,
            empty: false,
        });
        view.destroy();
        expect(root.engine.can("focus", { itemId: "app" })).toBe(false);
        expect(root.engine.run("focus", { itemId: "app" })).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
    });

    it("makes a new engine for another model, dropping the old one's loads", async () => {
        const loads: AbortSignal[] = [];
        const loadChildren = (
            _item: unknown,
            context: { signal: AbortSignal },
        ) =>
            new Promise<TreeItemJson<FileTypes>[]>(() => {
                loads.push(context.signal);
            });
        const first = filesModel({ expandedItemIds: ["src", "lib"] });
        const view = await renderFiles({ model: first, loadChildren });
        const engine = view.component.root().engine;
        expect(loads).toHaveLength(1);
        const second = createTreeModel<FileTypes>(
            files({ rootItemIds: ["readme", "src"], expandedItemIds: [] }),
        );
        await view.set("model", second);
        expect(loads[0]?.aborted).toBe(true);
        expect(view.component.root().model()).toBe(second);
        // the handle's engine is the same object, now the new engine's
        expect(view.component.root().engine).toBe(engine);
        expect(
            items().map((item) => item.getAttribute("data-tree-path")),
        ).toEqual(["/0", "/1"]);
        // the new engine drives the new tree: DOM focus, its keyboard
        await focus(itemElement("readme.md"));
        await press("ArrowDown");
        expect(itemElement("src")).toHaveFocus();
        expect(second.state.focusedItemId).toBe("src");
        expect(first.state.focusedItemId).not.toBe("src");
        // the old model no longer drives the tree on screen
        first.run("item.collapse", { itemId: "src" });
        await settle();
        expect(items()).toHaveLength(2);
    });

    it("reports the empty tree", async () => {
        const view = await renderFiles({
            model: createTreeModel<FileTypes>(),
        });
        expect(view.component.root().state().empty).toBe(true);
        expect(document.querySelector('[role="tree"]')).toHaveAttribute(
            "data-empty",
            "",
        );
    });
});
