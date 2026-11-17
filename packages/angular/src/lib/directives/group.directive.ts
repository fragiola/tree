import {
    computed,
    Directive,
    type DoCheck,
    type EmbeddedViewRef,
    effect,
    forwardRef,
    inject,
    input,
    type Signal,
    signal,
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
    bindFeatureAttributes,
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
    sameItems,
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
export class TreeGroupDirective implements TreeGroupContext, DoCheck {
    /** render the children while the item is collapsed too, hidden (default false) */
    readonly keepMounted = input(false, { transform: booleanInput });

    private readonly context = injectTreeContext("[treeGroup]");
    private readonly item = injectItemContext("[treeGroup]");
    private readonly host = injectHost();
    /** how many `<ng-template treeItems>` inside it render its children (see `adopt`) */
    private readonly adopted = signal(0);
    /** the template it renders with when it has none of its own */
    private readonly inherited = inject(TREE_ITEMS, { optional: true });
    private readonly detached = new DetachedViews();

    /** the enclosing item's state */
    readonly state: Signal<TreeItemState> = this.item.state;

    /** the item's children while the group is open (expanded, or `keepMounted`) */
    readonly children: Signal<readonly ItemOf<AnyTypes>[]> = computed(
        () => {
            if (!this.item.state().expanded && !this.keepMounted()) return [];
            const items = this.context.state().items;
            return (this.item.item().childItemIds ?? []).flatMap((itemId) => {
                const child = items[itemId];
                return child ? [child] : [];
            });
        },
        // a drag step or a focus change keeps the list: no view is synced for it
        { equal: sameItems },
    );

    /** the views of the children it renders itself, with the enclosing template */
    private views: KeyedViews<EmbeddedViewRef<TreeItemsContext>> | undefined;

    protected readonly itemData = computed(() => itemData(this.state()));

    constructor() {
        // the installed features' data-* (`data-selected` with `selection()`)
        bindFeatureAttributes(
            this.host,
            () => this.state().attributes,
            "data-",
        );
        bindStructuralStyle(this.host, () => ({
            ...depthStyle(this.state()),
            ...(this.state().expanded ? {} : { display: "none" }),
        }));

        // with no template of its own, the enclosing one renders the children, in no container:
        // their nodes are placed inside the group
        effect(() => {
            const own = this.adopted() > 0;
            const children = this.children();
            untracked(() => {
                if (own || !this.inherited) {
                    this.views?.clear();
                    this.views = undefined;
                    return;
                }
                this.views ??= new KeyedViews(null);
                const current = this.views;
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
        onDestroy(() => this.views?.clear());
    }

    adopt(): () => void {
        this.adopted.update((count) => count + 1);
        let released = false;
        return () => {
            if (released) return;
            released = true;
            this.adopted.update((count) => count - 1);
        };
    }

    /**
     * The children's views are in no container: the application checks them on their own, and a
     * zoneless tick skips them unless they are dirty. When the view the group is in is checked
     * (the app's template may read plain fields, not only signals), they are checked too.
     */
    ngDoCheck(): void {
        if (!this.views) return;
        for (const item of untracked(this.children)) {
            this.views.get(item.id)?.markForCheck();
        }
    }

    /** Puts the views' nodes inside the group, in order, when they are not already. */
    private placeInside(nodes: readonly Node[]): void {
        const wanted = new Set(nodes);
        const inside = [...this.host.childNodes].filter((node) =>
            wanted.has(node),
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
