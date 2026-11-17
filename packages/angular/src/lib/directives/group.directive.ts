import {
    computed,
    contentChild,
    Directive,
    type EmbeddedViewRef,
    effect,
    forwardRef,
    inject,
    input,
    type Signal,
    type TemplateRef,
    untracked,
} from "@angular/core";
import type { AnyTypes, ItemOf } from "@fragiola/tree";
import {
    injectItemContext,
    injectTreeContext,
    TREE_GROUP,
    TREE_ITEMS,
    type TreeGroupContext,
} from "../context";
import {
    bindStructuralStyle,
    booleanInput,
    injectHost,
    onDestroy,
} from "../utils/helpers";
import {
    depthStyle,
    ITEM_DATA_HOST,
    itemData,
    type TreeItemState,
} from "../utils/item-state";
import {
    DetachedViews,
    KeyedViews,
    rootNodesOf,
    type SignalContext,
    signalContext,
} from "../utils/views";
import type { TreeItemsContext } from "./templates.directive";

/**
 * The children of the enclosing `[treeItem]` (`role="group"`): `<div treeGroup></div>`. While the
 * item is expanded (or always, hidden, with `keepMounted`) it renders each child, keyed by its id,
 * with its own `<ng-template treeItems let-item>` or, with none, the enclosing `treeItems`
 * template: the recursion is one template. While the item is collapsed it is empty and hidden
 * (`display: none`). Its state is the item's.
 */
@Directive({
    selector: "[treeGroup]",
    exportAs: "treeGroup",
    providers: [
        {
            provide: TREE_GROUP,
            useExisting: forwardRef(() => TreeGroupDirective),
        },
    ],
    host: {
        role: "group",
        "data-tree-part": "group",
        ...ITEM_DATA_HOST,
    },
})
export class TreeGroupDirective implements TreeGroupContext {
    /** render the children while the item is collapsed too, hidden (default false) */
    readonly keepMounted = input(false, { transform: booleanInput });

    private readonly context = injectTreeContext("[treeGroup]");
    private readonly item = injectItemContext("[treeGroup]");
    private readonly host = injectHost();
    /** its own template (an `<ng-template treeItems>` directly inside it) */
    private readonly own = contentChild(TREE_ITEMS, { descendants: false });
    /** the template it renders with when it has none of its own */
    private readonly inherited = inject(TREE_ITEMS, { optional: true });
    private readonly detached = new DetachedViews();

    /** the enclosing item's state */
    readonly state: Signal<TreeItemState> = this.item.state;

    /** the item's children while the group is open (expanded, or `keepMounted`) */
    readonly children: Signal<readonly ItemOf<AnyTypes>[]> = computed(() => {
        const state = this.state();
        if (!state.expanded && !this.keepMounted()) return [];
        const items = this.context.state().items;
        return (this.item.item().childItemIds ?? []).flatMap((itemId) => {
            const child = items[itemId];
            return child ? [child] : [];
        });
    });

    protected readonly itemData = computed(() => itemData(this.state()));

    constructor() {
        bindStructuralStyle(this.host, () => ({
            ...depthStyle(this.state()),
            ...(this.state().expanded ? {} : { display: "none" }),
        }));

        // with no template of its own, the enclosing one renders the children, in no container:
        // their nodes are placed inside the group
        let views: KeyedViews<EmbeddedViewRef<TreeItemsContext>> | undefined;
        effect(() => {
            const own = this.own();
            const children = this.children();
            untracked(() => {
                if (own || !this.inherited) {
                    views?.clear();
                    views = undefined;
                    return;
                }
                views ??= new KeyedViews(null);
                const current = views;
                const template = this.inherited
                    .template as TemplateRef<TreeItemsContext>;
                current.sync(
                    children.map((item) => ({
                        key: item.id,
                        create: () =>
                            this.detached.embedded(
                                template,
                                signalContext<TreeItemsContext>({
                                    $implicit: item,
                                    item,
                                }),
                            ),
                        update: (view) =>
                            (
                                view.context as unknown as SignalContext<TreeItemsContext>
                            ).update({ $implicit: item, item }),
                    })),
                );
                this.placeInside(
                    children.flatMap((item) => {
                        const view = current.get(item.id);
                        return view ? rootNodesOf(view) : [];
                    }),
                );
            });
        });
        onDestroy(() => views?.clear());
    }

    /** Puts the views' nodes inside the group, in order, when they are not already. */
    private placeInside(nodes: readonly Node[]): void {
        const inside = [...this.host.childNodes].filter((node) =>
            nodes.includes(node),
        );
        if (
            inside.length === nodes.length &&
            inside.every((node, index) => node === nodes[index])
        ) {
            return;
        }
        for (const node of nodes) {
            this.host.appendChild(node);
        }
    }
}
