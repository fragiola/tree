// Type fixtures, checked by `ngc` (strict templates), never run: the registry `T` flows from the
// model into the root's inputs, the items template's context and the injection functions, with no
// cast. `@ts-expect-error` marks what must not compile.
import { Component, signal } from "@angular/core";
import type { SelectionFeature } from "../../selection/public-api";
import {
    createTreeModel,
    type InjectTreeItemResult,
    type InjectTreeResult,
    type ItemOf,
    injectTree,
    injectTreeItem,
    injectTreeState,
    TREE,
    type TreeItemsContext,
    TreeItemsDirective,
    type TreeModel,
    type TreeRootDirective,
    type TreeStateOf,
} from "../../src/public-api";

type Types = {
    items: { folder: undefined; file: { size: number } };
};

const model = createTreeModel<Types>({
    version: 1,
    rootItemIds: ["a"],
    items: { a: { kind: "file", label: "a.ts", data: { size: 1 } } },
});
declare const context: unknown;

// the context guard narrows the template context to the registry of the given model
declare const items: TreeItemsDirective<Types>;
if (TreeItemsDirective.ngTemplateContextGuard(items, context)) {
    const typed: TreeItemsContext<Types> = context;
    const item: ItemOf<Types> = typed.$implicit;
    if (item.kind === "file") {
        const size: number = item.data.size;
        void size;
    }
    // @ts-expect-error an item of the registry has no other kind
    void (item.kind === "other");
}

// the root's handle is typed by its registry
declare const root: TreeRootDirective<Types>;
const rootModel: TreeModel<Types> = root.model();
void rootModel;
// @ts-expect-error the handle's model is read through its signal
void root.model.state;

/** Typed by the model given to the root and to the items template. */
@Component({
    selector: "fixture-typed",
    imports: [TREE],
    template: `
        <div
            [treeRoot]="model"
            #tree="treeRoot"
            [(expandedItemIds)]="expanded"
            [selectedItemIds]="selected()"
            (selectedItemIdsChange)="selected.set($event)"
            checkboxes
            expandOnClick
            [loadChildren]="load"
            aria-label="Files"
        >
            <ng-template [treeItems]="model" let-item>
                <div [treeItem]="item" #node="treeItem">
                    <div treeItemContent [class.open]="node.state().expanded">
                        {{ item.kind === "file" ? item.data.size : item.label }}
                        @if (node.state().renaming) {
                            <input treeItemRename #rename="treeItemRename" aria-label="Name" [class.bad]="rename.state().invalid" (renameError)="code = $event.code" />
                        }
                    </div>
                    <div treeGroup keepMounted></div>
                </div>
            </ng-template>
            <div treeDropIndicator #indicator="treeDropIndicator">{{ indicator.state()?.position }}</div>
            <div treeLiveRegion></div>
        </div>
        <button type="button" (click)="tree.model().run('tree.collapse-all', {})">Collapse</button>
    `,
})
export class Typed {
    readonly model = model;
    readonly expanded = signal<string[]>([]);
    readonly selected = signal<readonly string[]>([]);
    code = "";
    readonly load = async () => [];
}

/** The injection functions take the registry as their type argument. */
@Component({ selector: "fixture-inject", template: "" })
export class Injected {
    readonly tree: InjectTreeResult<Types> = injectTree<Types>();
    readonly item: InjectTreeItemResult<Types> = injectTreeItem<Types>();
    readonly count = injectTreeState<Types, number>(
        (state) =>
            (state as TreeStateOf<Types, readonly [SelectionFeature]>)
                .selectedItemIds.length,
    );
    readonly size = injectTreeState(
        (state) => {
            const item = state.items.a;
            return item?.kind === "file" ? item.data.size : 0;
        },
        { model },
    );

    check(): void {
        const size: number = this.size();
        void size;
        const kind: "folder" | "file" = this.item.item().kind;
        void kind;
        this.tree.model().run("item.expand", { itemId: "a" });
        // @ts-expect-error a command takes its own payload
        this.tree.model().run("item.expand", { id: "a" });
        // @ts-expect-error the state's lists are read-only
        this.tree.model().state.selectedItemIds.push("a");
    }
}
