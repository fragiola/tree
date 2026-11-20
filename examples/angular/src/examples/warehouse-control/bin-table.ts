import { Component, computed, input } from "@angular/core";
import { injectTreeState } from "@fragiola/tree-angular";
import * as styles from "./styles";
import { type ControlModel, formatPercent, lowestBins } from "./warehouse";

const ROWS = 8;

let nextInstance = 0;

/** The scope's bins, lowest stock first: what to refill next. */
@Component({
    selector: "example-control-bin-table",
    host: { class: "contents" },
    template: `
        <section [attr.aria-labelledby]="titleId" [class]="styles.panel">
            <h2 [id]="titleId" [class]="styles.panelTitle">Bins, lowest stock first</h2>
            <table [attr.aria-labelledby]="titleId" [class]="styles.table">
                <thead>
                    <tr>
                        <th scope="col" [class]="styles.headCell">Bin</th>
                        <th scope="col" [class]="styles.headCell">Product</th>
                        <th scope="col" [class]="styles.numberHeadCell">Units / min</th>
                        <th scope="col" [class]="styles.numberHeadCell">Fill</th>
                        <th scope="col" [class]="styles.headCell">State</th>
                    </tr>
                </thead>
                <tbody>
                    @for (bin of bins(); track bin.id) {
                        <tr>
                            <th scope="row" [class]="styles.cell">{{ bin.label }}</th>
                            <td [class]="styles.cell">{{ bin.data.product }}</td>
                            <td [class]="styles.numberCell">{{ bin.data.quantity }} / {{ bin.data.minimum }}</td>
                            <td [class]="styles.numberCell">{{ formatPercent(bin.data.quantity / bin.data.capacity) }}</td>
                            <td [class]="styles.cell">
                                <span [class]="styles.badge(bin.data.quantity < bin.data.minimum)">
                                    {{ bin.data.quantity < bin.data.minimum ? "Low" : "OK" }}
                                </span>
                            </td>
                        </tr>
                    }
                </tbody>
            </table>
        </section>
    `,
})
export class BinTable {
    protected readonly styles = styles;
    protected readonly formatPercent = formatPercent;
    protected readonly titleId = `warehouse-control-bins-${nextInstance++}`;
    readonly model = input.required<ControlModel>();
    readonly scopeId = input.required<string>();
    private readonly state = injectTreeState((state) => state, {
        model: this.model,
    });
    protected readonly bins = computed(() =>
        lowestBins(this.state(), this.scopeId(), ROWS),
    );
}
