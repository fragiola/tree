import { Component, computed, input } from "@angular/core";
import { injectTreeState } from "@fragiola/tree-angular";
import * as styles from "./styles";
import {
    type ControlModel,
    formatPercent,
    formatUnits,
    type LiveLog,
    stockIn,
    unitsMoved,
} from "./warehouse";

/** The scope's key figures: what is on hand, how full it is, what is low, what moved. */
@Component({
    selector: "example-control-kpis",
    host: { class: "contents" },
    template: `
        <section aria-label="Key figures">
            <dl [class]="styles.kpis">
                <div [class]="styles.kpi">
                    <dt [class]="styles.kpiTerm">Units on hand</dt>
                    <dd [class]="styles.kpiValue" data-testid="kpi-units">{{ formatUnits(stock().units) }}</dd>
                    <dd aria-hidden="true" [class]="styles.kpiNote(false)">
                        <svg aria-hidden="true" viewBox="0 0 100 24" preserveAspectRatio="none" [attr.class]="styles.spark">
                            <polyline [attr.points]="points()" vector-effect="non-scaling-stroke" [attr.class]="styles.sparkLine" />
                        </svg>
                    </dd>
                </div>
                <div [class]="styles.kpi">
                    <dt [class]="styles.kpiTerm">Fill</dt>
                    <dd [class]="styles.kpiValue" data-testid="kpi-fill">{{ formatPercent(stock().units / stock().capacity) }}</dd>
                    <dd [class]="styles.kpiNote(false)">of {{ formatUnits(stock().capacity) }} units</dd>
                </div>
                <div [class]="styles.kpi">
                    <dt [class]="styles.kpiTerm">Low-stock bins</dt>
                    <dd [class]="styles.kpiValue" data-testid="kpi-low">{{ stock().low }}</dd>
                    <dd [class]="styles.kpiNote(stock().low > 0)">of {{ stock().bins }} bins</dd>
                </div>
                <div [class]="styles.kpi">
                    <dt [class]="styles.kpiTerm">Moved, last minute</dt>
                    <dd [class]="styles.kpiValue" data-testid="kpi-moved">{{ formatUnits(moved()) }}</dd>
                    <dd [class]="styles.kpiNote(false)">units in and out</dd>
                </div>
            </dl>
        </section>
    `,
})
export class Kpis {
    protected readonly styles = styles;
    protected readonly formatUnits = formatUnits;
    protected readonly formatPercent = formatPercent;
    readonly model = input.required<ControlModel>();
    readonly log = input.required<LiveLog>();
    readonly scopeId = input.required<string>();
    private readonly state = injectTreeState((state) => state, {
        model: this.model,
    });
    protected readonly stock = computed(() =>
        stockIn(this.state(), this.scopeId()),
    );
    protected readonly moved = computed(() => {
        this.state();
        return unitsMoved(this.model(), this.log(), this.scopeId());
    });
    /** the sparkline: a line over the last values, scaled to their range (SVG, no chart library) */
    protected readonly points = computed(() => {
        const values = this.log().states.map(
            (state) => stockIn(state, this.scopeId()).units,
        );
        if (values.length < 2) return "0,12 100,12";
        const min = Math.min(...values);
        const range = Math.max(...values) - min || 1;
        const step = 100 / (values.length - 1);
        return values
            .map(
                (value, index) =>
                    `${(index * step).toFixed(1)},${(22 - ((value - min) / range) * 20).toFixed(1)}`,
            )
            .join(" ");
    });
}
