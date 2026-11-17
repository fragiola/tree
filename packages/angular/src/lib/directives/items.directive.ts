import {
    computed,
    Directive,
    type EmbeddedViewRef,
    effect,
    forwardRef,
    inject,
    input,
    type Signal,
    TemplateRef,
    untracked,
    ViewContainerRef,
} from "@angular/core";
import type { AnyTypes, ItemOf, TreeTypes } from "@fragiola/tree";
import { injectTreeContext, TREE_GROUP, TREE_ITEMS } from "../context";
import { onDestroy } from "../utils/helpers";
import { KeyedViews, type SignalContext, signalContext } from "../utils/views";
import type { TreeItemsContext, TypedBy } from "./templates.directive";

/**
 * Renders its template for each item, in order, keyed by its id: directly inside `[treeRoot]`, the
 * root items; inside a `[treeGroup]`, that group's children. It renders no element of its own;
 * you own the recursion (a `[treeGroup]` with no template of its own renders its children with
 * the enclosing `treeItems` template).
 *
 * ```html
 * <ng-template [treeItems]="model" let-item>
 *     <div [treeItem]="item"><div treeItemContent>{{ item.label }}</div><div treeGroup></div></div>
 * </ng-template>
 * ```
 */
@Directive({
    selector: "ng-template[treeItems]",
    exportAs: "treeItems",
    providers: [
        {
            provide: TREE_ITEMS,
            useExisting: forwardRef(() => TreeItemsDirective),
        },
    ],
})
export class TreeItemsDirective<T extends TreeTypes = AnyTypes> {
    /** the model or the document, to type the template's items by its registry (optional) */
    readonly treeItems = input<TypedBy<T>>(undefined);
    readonly template = inject<TemplateRef<unknown>>(TemplateRef);

    private readonly context = injectTreeContext("[treeItems]");
    private readonly group = inject(TREE_GROUP, { optional: true });
    private readonly container = inject(ViewContainerRef);

    /** the items it renders now: the root items, or its group's children */
    readonly items: Signal<readonly ItemOf<T>[]> = computed(() => {
        if (this.group) {
            return this.group.children() as unknown as readonly ItemOf<T>[];
        }
        const tree = this.context.state();
        return tree.rootItemIds.flatMap((itemId) => {
            const item = tree.items[itemId];
            return item ? [item as unknown as ItemOf<T>] : [];
        });
    });

    constructor() {
        const views = new KeyedViews<EmbeddedViewRef<TreeItemsContext<T>>>(
            this.container,
        );
        const template = this.template as unknown as TemplateRef<
            TreeItemsContext<T>
        >;
        effect(() => {
            const items = this.items();
            untracked(() =>
                views.sync(
                    items.map((item) => ({
                        key: item.id,
                        create: (index) =>
                            this.container.createEmbeddedView(
                                template,
                                signalContext<TreeItemsContext<T>>({
                                    $implicit: item,
                                    item,
                                }),
                                { index },
                            ),
                        update: (view) =>
                            (
                                view.context as unknown as SignalContext<
                                    TreeItemsContext<T>
                                >
                            ).update({ $implicit: item, item }),
                    })),
                ),
            );
        });
        onDestroy(() => views.clear());
    }

    static ngTemplateContextGuard<T extends TreeTypes>(
        _directive: TreeItemsDirective<T>,
        _context: unknown,
    ): _context is TreeItemsContext<T> {
        return true;
    }
}
