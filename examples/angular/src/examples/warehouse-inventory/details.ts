import { Component, computed, input } from "@angular/core";
import { injectTreeState } from "@fragiola/tree-angular";
import type { WarehouseModel } from "./features";
import { ProductActions } from "./product-actions";
import * as styles from "./styles";
import {
    ancestorIds,
    formatUnits,
    STORAGE_NAMES,
    stockTotals,
} from "./warehouse";

/** The selected location or product: where it is, its stock, and what can be done with it. */
@Component({
    selector: "example-warehouse-details",
    imports: [ProductActions],
    host: { class: "contents" },
    template: `
        <section aria-label="Details" [class]="styles.details">
            @if (item(); as item) {
                <p [class]="styles.path">{{ path() }}</p>
                <h2 [class]="styles.title">{{ item.label }}</h2>
                <dl [class]="styles.facts">
                    @switch (item.kind) {
                        @case ("product") {
                            <div [class]="styles.fact"><dt [class]="styles.term">SKU</dt><dd [class]="styles.value">{{ product()?.data?.sku }}</dd></div>
                            <div [class]="styles.fact"><dt [class]="styles.term">Needs</dt><dd [class]="styles.value">{{ needs() }}</dd></div>
                            <div [class]="styles.fact"><dt [class]="styles.term">Minimum</dt><dd [class]="styles.value">{{ product()?.data?.minimum }} units</dd></div>
                        }
                        @case ("bin") {
                            <div [class]="styles.fact"><dt [class]="styles.term">Fill</dt><dd [class]="styles.value">{{ formatUnits(units()) }} of {{ capacity() }} units</dd></div>
                            <div [class]="styles.fact"><dt [class]="styles.term">Products</dt><dd [class]="styles.value">{{ item.childItemIds?.length ?? 0 }}</dd></div>
                        }
                        @default {
                            <div [class]="styles.fact"><dt [class]="styles.term">Units</dt><dd [class]="styles.value">{{ formatUnits(units()) }}</dd></div>
                            <div [class]="styles.fact"><dt [class]="styles.term">Low on stock</dt><dd [class]="styles.value">{{ stock()?.low ?? 0 }}</dd></div>
                        }
                    }
                </dl>
                @if (product(); as product) {
                    <example-warehouse-product-actions [model]="model()" [item]="product" />
                }
            } @else {
                <p [class]="styles.empty">Select a location or a product.</p>
            }
        </section>
    `,
})
export class Details {
    protected readonly styles = styles;
    protected readonly formatUnits = formatUnits;
    readonly model = input.required<WarehouseModel>();
    /** the selection is the tree's: one item at a time, read from the model */
    protected readonly item = injectTreeState(
        (state, current) => {
            const [selectedId] = state.selectedItemIds;
            return selectedId === undefined
                ? undefined
                : current.get("item-by", { id: selectedId });
        },
        { model: this.model },
    );
    protected readonly product = computed(() => {
        const item = this.item();
        return item?.kind === "product" ? item : undefined;
    });
    protected readonly needs = computed(() => {
        const product = this.product();
        return product ? STORAGE_NAMES[product.data.storage] : "";
    });
    protected readonly capacity = computed(() => {
        const item = this.item();
        return item?.kind === "bin" ? item.data.capacity : 0;
    });
    private readonly state = injectTreeState((state) => state, {
        model: this.model,
    });
    protected readonly stock = computed(() => {
        this.state();
        const item = this.item();
        return item
            ? stockTotals(this.model()).byItemId.get(item.id)
            : undefined;
    });
    protected readonly units = computed(() => this.stock()?.units ?? 0);
    protected readonly path = computed(() => {
        this.state();
        const item = this.item();
        const model = this.model();
        return item
            ? ancestorIds(model, item.id)
                  .map((id) => model.get("item-by", { id })?.label ?? id)
                  .join(" › ")
            : "";
    });
}
