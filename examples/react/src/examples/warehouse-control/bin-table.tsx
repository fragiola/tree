import { useTreeState } from "@fragiola/tree-react";
import { useId } from "react";
import * as styles from "./styles";
import { type ControlModel, formatPercent, lowestBins } from "./warehouse";

const ROWS = 8;

/** The scope's bins, lowest stock first: what to refill next. */
export function BinTable({
    model,
    scopeId,
}: {
    model: ControlModel;
    scopeId: string;
}) {
    const titleId = useId();
    const bins = useTreeState((state) => lowestBins(state, scopeId, ROWS), {
        model,
    });
    return (
        <section aria-labelledby={titleId} className={styles.panel}>
            <h2 id={titleId} className={styles.panelTitle}>
                Bins, lowest stock first
            </h2>
            <table aria-labelledby={titleId} className={styles.table}>
                <thead>
                    <tr>
                        <th scope="col" className={styles.headCell}>
                            Bin
                        </th>
                        <th scope="col" className={styles.headCell}>
                            Product
                        </th>
                        <th scope="col" className={styles.numberHeadCell}>
                            Units / min
                        </th>
                        <th scope="col" className={styles.numberHeadCell}>
                            Fill
                        </th>
                        <th scope="col" className={styles.headCell}>
                            State
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {bins.map((bin) => {
                        const lowStock = bin.data.quantity < bin.data.minimum;
                        return (
                            <tr key={bin.id}>
                                <th scope="row" className={styles.cell}>
                                    {bin.label}
                                </th>
                                <td className={styles.cell}>
                                    {bin.data.product}
                                </td>
                                <td className={styles.numberCell}>
                                    {bin.data.quantity} / {bin.data.minimum}
                                </td>
                                <td className={styles.numberCell}>
                                    {formatPercent(
                                        bin.data.quantity / bin.data.capacity,
                                    )}
                                </td>
                                <td className={styles.cell}>
                                    <span className={styles.badge(lowStock)}>
                                        {lowStock ? "Low" : "OK"}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </section>
    );
}
