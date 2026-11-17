import {
    Directive,
    type EmbeddedViewRef,
    effect,
    inject,
    input,
    TemplateRef,
    untracked,
    ViewContainerRef,
} from "@angular/core";
import type { AnyTypes, TreeTypes } from "@fragiola/tree";
import { injectTreeContext } from "../context";
import { injectTreeVirtualWindow } from "../inject/inject-tree-virtual-window";
import { onDestroy } from "../utils/helpers";
import { KeyedViews, type SignalContext, signalContext } from "../utils/views";
import type { TreeVirtualItemsContext, TypedBy } from "./templates.directive";

/** A spacer: the space of the rows that are not rendered (`data-tree-part="spacer"`). */
function createSpacer(document: Document): HTMLElement {
    const element = document.createElement("div");
    element.setAttribute("aria-hidden", "true");
    element.setAttribute("data-tree-part", "spacer");
    return element;
}

/**
 * The rows of a virtualized tree (`[treeRoot]` with `virtual`): renders its template for each
 * visible item in view plus the overscan, in order, keyed by its id, flat (each item carries its
 * `aria-level`, `aria-posinset` and `aria-setsize`), between spacers that take the place of the
 * others. Put it directly inside `[treeRoot]`; render a `[treeItem]` with no `[treeGroup]`.
 *
 * ```html
 * <div [treeRoot]="model" [virtual]="virtual" style="height: 400px; overflow: auto">
 *     <ng-template [treeVirtualItems]="model" let-item>
 *         <div [treeItem]="item"><div treeItemContent>{{ item.label }}</div></div>
 *     </ng-template>
 * </div>
 * ```
 */
@Directive({
    selector: "ng-template[treeVirtualItems]",
    exportAs: "treeVirtualItems",
})
export class TreeVirtualItemsDirective<T extends TreeTypes = AnyTypes> {
    /** the model or the document, to type the template's items by its registry (optional) */
    readonly treeVirtualItems = input<TypedBy<T>>(undefined);
    readonly template = inject<TemplateRef<unknown>>(TemplateRef);

    private readonly context = injectTreeContext("[treeVirtualItems]");
    private readonly container = inject(ViewContainerRef);
    /** the window the template renders */
    readonly window = injectTreeVirtualWindow();

    constructor() {
        const views = new KeyedViews<
            EmbeddedViewRef<TreeVirtualItemsContext<T>>
        >(this.container);
        const template = this.template as unknown as TemplateRef<
            TreeVirtualItemsContext<T>
        >;
        const anchor = this.container.element.nativeElement as Node;
        const spacers = new Map<string, HTMLElement>();
        /** the spacer of `key`, sized, created the first time */
        const spacerOf = (key: string, size: number) => {
            let element = spacers.get(key);
            if (!element) {
                element = createSpacer(anchor.ownerDocument as Document);
                element.style.height = `${size}px`;
                // it keeps its size in a flex root
                element.style.flexShrink = "0";
                spacers.set(key, element);
            }
            element.style.height = `${size}px`;
            return element;
        };
        effect(() => {
            const current = this.window();
            const tree = this.context.state();
            untracked(() => {
                const rows = (current?.rows ?? []).flatMap((row) => {
                    const item = tree.items[row.itemId];
                    return item ? [{ row, item }] : [];
                });
                views.sync(
                    rows.map(({ row, item }) => {
                        const next = {
                            $implicit: item,
                            item,
                            row,
                        } as unknown as TreeVirtualItemsContext<T>;
                        return {
                            key: row.itemId,
                            create: (index: number) =>
                                this.container.createEmbeddedView(
                                    template,
                                    signalContext(next),
                                    { index },
                                ),
                            update: (view) =>
                                (
                                    view.context as unknown as SignalContext<
                                        TreeVirtualItemsContext<T>
                                    >
                                ).update(next),
                        };
                    }),
                );
                // the spacers go before their rows' nodes, and the last one after the last row
                const used = new Set<string>();
                let last: Node | undefined;
                for (const { row } of rows) {
                    const nodes = views.get(row.itemId)?.rootNodes as
                        | Node[]
                        | undefined;
                    const first = nodes?.[0];
                    if (!first || !nodes) continue;
                    if (row.spaceBefore > 0) {
                        const key = `before:${row.itemId}`;
                        used.add(key);
                        const element = spacerOf(key, row.spaceBefore);
                        if (first.previousSibling !== element) {
                            first.parentNode?.insertBefore(element, first);
                        }
                    }
                    last = nodes.at(-1);
                }
                const after = current?.spaceAfter ?? 0;
                if (after > 0) {
                    used.add("after");
                    const element = spacerOf("after", after);
                    const before = last ?? anchor;
                    if (before.nextSibling !== element) {
                        before.parentNode?.insertBefore(
                            element,
                            before.nextSibling,
                        );
                    }
                }
                for (const [key, element] of spacers) {
                    if (used.has(key)) continue;
                    element.remove();
                    spacers.delete(key);
                }
            });
        });
        onDestroy(() => {
            views.clear();
            for (const element of spacers.values()) element.remove();
            spacers.clear();
        });
    }

    static ngTemplateContextGuard<T extends TreeTypes>(
        _directive: TreeVirtualItemsDirective<T>,
        _context: unknown,
    ): _context is TreeVirtualItemsContext<T> {
        return true;
    }
}
