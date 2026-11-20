import { useTreeState } from "@fragiola/tree-react";
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
export function Kpis({
    model,
    log,
    scopeId,
}: {
    model: ControlModel;
    log: LiveLog;
    scopeId: string;
}) {
    const units = useTreeState((state) => stockIn(state, scopeId).units, {
        model,
    });
    const capacity = useTreeState((state) => stockIn(state, scopeId).capacity, {
        model,
    });
    const bins = useTreeState((state) => stockIn(state, scopeId).bins, {
        model,
    });
    const low = useTreeState((state) => stockIn(state, scopeId).low, {
        model,
    });
    const moved = unitsMoved(model, log, scopeId);
    return (
        <dl role="group" aria-label="Key figures" className={styles.kpis}>
            <div className={styles.kpi}>
                <dt className={styles.kpiTerm}>Units on hand</dt>
                <dd className={styles.kpiValue} data-testid="kpi-units">
                    {formatUnits(units)}
                </dd>
                <dd aria-hidden className={styles.kpiNote(false)}>
                    <Sparkline
                        values={log.states.map(
                            (state) => stockIn(state, scopeId).units,
                        )}
                    />
                </dd>
            </div>
            <div className={styles.kpi}>
                <dt className={styles.kpiTerm}>Fill</dt>
                <dd className={styles.kpiValue} data-testid="kpi-fill">
                    {formatPercent(units / capacity)}
                </dd>
                <dd className={styles.kpiNote(false)}>
                    of {formatUnits(capacity)} units
                </dd>
            </div>
            <div className={styles.kpi}>
                <dt className={styles.kpiTerm}>Low-stock bins</dt>
                <dd className={styles.kpiValue} data-testid="kpi-low">
                    {low}
                </dd>
                <dd className={styles.kpiNote(low > 0)}>of {bins} bins</dd>
            </div>
            <div className={styles.kpi}>
                <dt className={styles.kpiTerm}>Moved, last minute</dt>
                <dd className={styles.kpiValue} data-testid="kpi-moved">
                    {formatUnits(moved)}
                </dd>
                <dd className={styles.kpiNote(false)}>units in and out</dd>
            </div>
        </dl>
    );
}

/** A line over the last values, scaled to their range (SVG, no chart library). */
function Sparkline({ values }: { values: readonly number[] }) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = values.length > 1 ? 100 / (values.length - 1) : 0;
    const points = values
        .map(
            (value, index) =>
                `${(index * step).toFixed(1)},${(22 - ((value - min) / range) * 20).toFixed(1)}`,
        )
        .join(" ");
    return (
        <svg
            aria-hidden
            viewBox="0 0 100 24"
            preserveAspectRatio="none"
            className={styles.spark}
        >
            <polyline
                points={values.length > 1 ? points : "0,12 100,12"}
                vectorEffect="non-scaling-stroke"
                className={styles.sparkLine}
            />
        </svg>
    );
}
