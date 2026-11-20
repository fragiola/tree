import { Component, computed, input } from "@angular/core";
import { injectTreeState } from "@fragiola/tree-angular";
import * as styles from "./styles";
import {
    type ControlModel,
    type FillBar,
    fillBars,
    fillTitle,
    formatPercent,
} from "./warehouse";

/** The chart's geometry, in its own units: a label column, a track, the figure. */
const WIDTH = 340;
const ROW = 22;
const LABEL = 142;
const TRACK = 140;

let nextInstance = 0;

/** How full each location under the scope is: one bar each, drawn as SVG. */
@Component({
    selector: "example-control-fill-chart",
    host: { class: "contents" },
    template: `
        <section [attr.aria-labelledby]="titleId" [class]="styles.panel">
            <h2 [id]="titleId" [class]="styles.panelTitle">{{ title() }}</h2>
            <svg
                role="img"
                [attr.aria-label]="summary()"
                [attr.viewBox]="'0 0 ' + WIDTH + ' ' + bars().length * ROW"
                [attr.class]="styles.chart"
                data-testid="fill-chart"
            >
                @for (bar of bars(); track bar.id; let index = $index) {
                    <svg:g>
                        <svg:text [attr.x]="0" [attr.y]="index * ROW + 15" [attr.class]="styles.chartLabel(bar.current)">{{ short(bar.label) }}</svg:text>
                        <svg:rect [attr.x]="LABEL" [attr.y]="index * ROW + 6" [attr.width]="TRACK" height="10" rx="2" [attr.class]="styles.chartTrack" />
                        <svg:rect
                            [attr.x]="LABEL"
                            [attr.y]="index * ROW + 6"
                            [attr.width]="min(1, ratioOf(bar)) * TRACK"
                            height="10"
                            rx="2"
                            [attr.class]="styles.chartBar(ratioOf(bar))"
                        />
                        <svg:text [attr.x]="LABEL + TRACK + 8" [attr.y]="index * ROW + 15" [attr.class]="styles.chartValue">{{ formatPercent(ratioOf(bar)) }}</svg:text>
                        @if (bar.low > 0) {
                            <svg:circle [attr.cx]="WIDTH - 6" [attr.cy]="index * ROW + 11" r="4" [attr.class]="styles.chartLow" />
                        }
                    </svg:g>
                }
            </svg>
        </section>
    `,
})
export class FillChart {
    protected readonly styles = styles;
    protected readonly formatPercent = formatPercent;
    protected readonly min = Math.min;
    protected readonly WIDTH = WIDTH;
    protected readonly ROW = ROW;
    protected readonly LABEL = LABEL;
    protected readonly TRACK = TRACK;
    protected readonly titleId = `warehouse-control-fill-${nextInstance++}`;
    readonly model = input.required<ControlModel>();
    readonly scopeId = input.required<string>();
    private readonly state = injectTreeState((state) => state, {
        model: this.model,
    });
    protected readonly bars = computed(
        () => {
            this.state();
            return fillBars(this.model(), this.scopeId());
        },
        { equal: sameBars },
    );
    protected readonly title = computed(() =>
        fillTitle(this.model(), this.scopeId()),
    );
    protected readonly summary = computed(() =>
        this.bars()
            .map(
                (bar) =>
                    `${bar.label} ${formatPercent(bar.units / bar.capacity)}${bar.low > 0 ? " (low stock)" : ""}`,
            )
            .join(", "),
    );

    protected ratioOf(bar: FillBar) {
        return bar.capacity === 0 ? 0 : bar.units / bar.capacity;
    }

    protected short(label: string) {
        return label.length > 21 ? `${label.slice(0, 20)}…` : label;
    }
}

/** Two lists of bars are the same when every figure is: the chart then keeps its render. */
function sameBars(a: readonly FillBar[], b: readonly FillBar[]) {
    return (
        a.length === b.length &&
        a.every((bar, index) => {
            const other = b[index];
            return (
                other !== undefined &&
                bar.id === other.id &&
                bar.label === other.label &&
                bar.units === other.units &&
                bar.low === other.low &&
                bar.current === other.current
            );
        })
    );
}
