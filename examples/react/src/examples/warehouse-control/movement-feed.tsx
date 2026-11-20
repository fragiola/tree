import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useId } from "react";
import { formatTime } from "../_kit/warehouse-live";
import * as styles from "./styles";
import { type ControlModel, type LiveLog, movementsIn } from "./warehouse";

const SHOWN = 7;

/** The scope's last stock movements, newest first. */
export function MovementFeed({
    model,
    log,
    scopeId,
}: {
    model: ControlModel;
    log: LiveLog;
    scopeId: string;
}) {
    const titleId = useId();
    const movements = movementsIn(model, log, scopeId).slice(0, SHOWN);
    return (
        <section aria-labelledby={titleId} className={styles.panel}>
            <h2 id={titleId} className={styles.panelTitle}>
                Stock movements
            </h2>
            {movements.length === 0 ? (
                <p className={styles.empty}>No movement yet.</p>
            ) : (
                <ol aria-labelledby={titleId} className={styles.feed}>
                    {movements.map((movement) => {
                        const bin = model.get("item-by", {
                            id: movement.binId,
                        });
                        return (
                            <li key={movement.id} className={styles.movement}>
                                <span className={styles.movementTime}>
                                    {formatTime(movement.time)}
                                </span>
                                {movement.kind === "pick" ? (
                                    <ArrowUpFromLine
                                        aria-hidden
                                        className={styles.movementIcon(
                                            movement.kind,
                                        )}
                                    />
                                ) : (
                                    <ArrowDownToLine
                                        aria-hidden
                                        className={styles.movementIcon(
                                            movement.kind,
                                        )}
                                    />
                                )}
                                <span className={styles.srOnly}>
                                    {movement.kind === "pick"
                                        ? "Pick"
                                        : "Receipt"}
                                </span>
                                <span className={styles.movementBin}>
                                    {bin?.label ?? movement.binId}
                                    {bin?.kind === "bin"
                                        ? ` · ${bin.data.product}`
                                        : ""}
                                </span>
                                <span
                                    className={styles.movementDelta(
                                        movement.kind,
                                    )}
                                >
                                    {movement.delta > 0
                                        ? `+${movement.delta}`
                                        : `−${-movement.delta}`}
                                </span>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}
