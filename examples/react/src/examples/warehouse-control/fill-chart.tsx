import { useTreeState } from "@fragiola/tree-react";
import { TriangleAlert } from "lucide-react";
import { useId } from "react";
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

/** How full each location under the scope is: one bar each, drawn as SVG. */
export function FillChart({
    model,
    scopeId,
}: {
    model: ControlModel;
    scopeId: string;
}) {
    const titleId = useId();
    const bars = useTreeState((_state, current) => fillBars(current, scopeId), {
        model,
        isEqual: sameBars,
    });
    const title = fillTitle(model, scopeId);
    return (
        <section aria-labelledby={titleId} className={styles.panel}>
            <h2 id={titleId} className={styles.panelTitle}>
                {title}
            </h2>
            <svg
                role="img"
                aria-label={bars
                    .map(
                        (bar) =>
                            `${bar.label} ${formatPercent(bar.units / bar.capacity)}`,
                    )
                    .join(", ")}
                viewBox={`0 0 ${WIDTH} ${bars.length * ROW}`}
                className={styles.chart}
                data-testid="fill-chart"
            >
                {bars.map((bar, index) => {
                    const ratio =
                        bar.capacity === 0 ? 0 : bar.units / bar.capacity;
                    const y = index * ROW;
                    return (
                        <g key={bar.id}>
                            <text
                                x={0}
                                y={y + 15}
                                className={styles.chartLabel(bar.current)}
                            >
                                {bar.label.length > 21
                                    ? `${bar.label.slice(0, 20)}…`
                                    : bar.label}
                            </text>
                            <rect
                                x={LABEL}
                                y={y + 6}
                                width={TRACK}
                                height={10}
                                rx={2}
                                className={styles.chartTrack}
                            />
                            <rect
                                x={LABEL}
                                y={y + 6}
                                width={Math.min(1, ratio) * TRACK}
                                height={10}
                                rx={2}
                                className={styles.chartBar(ratio)}
                            />
                            <text
                                x={LABEL + TRACK + 8}
                                y={y + 15}
                                className={styles.chartValue}
                            >
                                {formatPercent(ratio)}
                            </text>
                            {bar.low > 0 && (
                                <TriangleAlert
                                    x={WIDTH - 14}
                                    y={y + 4}
                                    width={14}
                                    height={14}
                                    className={styles.chartLow}
                                />
                            )}
                        </g>
                    );
                })}
            </svg>
        </section>
    );
}

/** Two lists of bars are the same when every figure is: the chart then keeps its render. */
const sameBars = (a: readonly FillBar[], b: readonly FillBar[]) =>
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
    });
