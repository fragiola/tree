import {
    Component,
    computed,
    effect,
    input,
    signal,
    untracked,
} from "@angular/core";
import type { ItemOf } from "@fragiola/tree-angular";
import { LucideArrowRightLeft } from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import type { WarehouseModel } from "./features";
import * as styles from "./styles";
import { binsFor, type WarehouseTypes } from "./warehouse";

let nextId = 0;

/** A product's quantity and its place: both go through commands, so the storage rules decide. */
@Component({
    selector: "example-warehouse-product-actions",
    imports: [ClickableButton, LucideArrowRightLeft],
    host: { class: "contents" },
    template: `
        <form [class]="styles.form" (submit)="updateQuantity($event)">
            <label [for]="quantityId" [class]="styles.term">Quantity</label>
            <div [class]="styles.formRow">
                <input
                    #quantityInput
                    [id]="quantityId"
                    type="number"
                    min="0"
                    step="1"
                    [value]="quantity()"
                    [class]="styles.input"
                    (input)="quantity.set(quantityInput.value)"
                />
                <button kitClickable type="submit" variant="outline" size="sm">Update</button>
            </div>
        </form>
        <form [class]="styles.form" (submit)="move($event)">
            <label [for]="binId" [class]="styles.term">Move to</label>
            <div [class]="styles.formRow">
                <select #binSelect [id]="binId" [class]="styles.select" (focus)="listBins()" (change)="target.set(binSelect.value)">
                    <option value="" [selected]="target() === ''">Choose a bin…</option>
                    @for (bin of bins(); track bin.id) {
                        <option [value]="bin.id" [selected]="target() === bin.id">{{ bin.label }}</option>
                    }
                </select>
                <button kitClickable type="submit" variant="outline" size="sm" [disabled]="target() === ''">
                    <svg lucideArrowRightLeft aria-hidden="true"></svg>
                    Move
                </button>
            </div>
        </form>
        <p role="status" data-testid="details-notice" [class]="styles.notice">{{ notice() }}</p>
    `,
})
export class ProductActions {
    protected readonly styles = styles;
    readonly model = input.required<WarehouseModel>();
    readonly item =
        input.required<Extract<ItemOf<WarehouseTypes>, { kind: "product" }>>();
    protected readonly quantityId = `warehouse-quantity-${nextId}`;
    protected readonly binId = `warehouse-bin-${nextId++}`;
    protected readonly quantity = signal("");
    protected readonly target = signal("");
    /** what the rules refused, or what was done */
    protected readonly notice = signal("");
    /**
     * the bins the rules accept for it, asked of the model (`model.can`) when the list is about to
     * show: it asks about every bin, too much for every change
     */
    protected readonly bins = signal<{ id: string; label: string }[]>([]);

    constructor() {
        // another product: its own quantity, nothing chosen, nothing said
        const id = computed(() => this.item().id);
        effect(() => {
            id();
            untracked(() => {
                this.quantity.set(String(this.item().data.quantity));
                this.target.set("");
                this.notice.set("");
            });
        });
    }

    protected listBins() {
        this.bins.set(binsFor(this.model(), this.item().id));
    }

    protected updateQuantity(event: Event) {
        event.preventDefault();
        if (this.quantity().trim() === "") {
            this.notice.set("Enter a quantity.");
            return;
        }
        const item = this.item();
        const result = this.model().run("item.set-data", {
            itemId: item.id,
            data: { ...item.data, quantity: Number(this.quantity()) },
        });
        this.notice.set(result.ok ? "Quantity updated." : result.error.message);
    }

    protected move(event: Event) {
        event.preventDefault();
        const target = this.target();
        if (target === "") return;
        const model = this.model();
        const result = model.run("item.move", {
            itemIds: [this.item().id],
            // last in the bin
            to: {
                parentItemId: target,
                index: model.get("child-items-by", { itemId: target }).length,
            },
        });
        this.notice.set(result.ok ? "Moved." : result.error.message);
        this.target.set("");
    }
}
