import { type TreeRef, useTreeState } from "@fragiola/tree-react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";
import {
    type BoardTypes,
    columnsOf,
    neighbours,
    PEOPLE,
    progressOf,
    STATUS_NAMES,
    type Status,
    scopeOf,
    setStatus,
} from "./board";
import type { BoardFeatures, BoardModel } from "./model";
import * as styles from "./styles";

/**
 * The board: the tasks of the selected project or epic in four columns, read from the model. A
 * tree row dropped on a column moves to its status (the model's `dropOutside()`, which finds the
 * column by `data-status-column`); a card's buttons move it one column. Both run commands.
 */
export function BoardView({
    model,
    tree,
}: {
    model: BoardModel;
    tree: TreeRef<BoardTypes, BoardFeatures>;
}) {
    const scope = useTreeState(
        (_state, current) => scopeOf(current)?.label ?? "",
        { model },
    );
    const columns = useTreeState((_state, current) => columnsOf(current), {
        model,
    });
    const over = useColumnUnderDrag(tree);
    return (
        <section aria-label="Board" className={styles.board}>
            <h2 className={styles.boardTitle}>{scope}</h2>
            <div className={styles.columns}>
                {columns.map(({ status, cards }) => (
                    <section
                        key={status}
                        aria-label={STATUS_NAMES[status]}
                        data-status-column={status}
                        data-over={over === status ? "" : undefined}
                        className={styles.column}
                    >
                        <h3 className={styles.columnTitle}>
                            {STATUS_NAMES[status]}
                            <span>{cards.length}</span>
                        </h3>
                        <ul className={styles.cards}>
                            {cards.length === 0 && (
                                <li className={styles.empty}>
                                    Drop a task here
                                </li>
                            )}
                            {cards.map((card) => (
                                <Card
                                    key={card.id}
                                    model={model}
                                    id={card.id}
                                    label={card.label}
                                    status={status}
                                    assigneeId={
                                        card.kind === "task"
                                            ? card.data.assigneeId
                                            : null
                                    }
                                />
                            ))}
                        </ul>
                    </section>
                ))}
            </div>
        </section>
    );
}

function Card({
    model,
    id,
    label,
    status,
    assigneeId,
}: {
    model: BoardModel;
    id: string;
    label: string;
    status: Status;
    assigneeId: string | null;
}) {
    const { previous, next } = neighbours(status);
    const progress = useTreeState(
        (_state, current) => {
            const { done, total } = progressOf(current, id);
            return total > 1 ? `${done}/${total} done` : "";
        },
        { model },
    );
    const person = PEOPLE.find((candidate) => candidate.id === assigneeId);
    return (
        <li data-testid="card" className={styles.card}>
            {label}
            <div className={styles.cardMeta}>
                <span className={styles.cardPerson}>
                    {person?.name ?? "Unassigned"}
                </span>
                {progress !== "" && (
                    <span className={styles.cardProgress}>{progress}</span>
                )}
                <span className={styles.cardActions}>
                    {previous && (
                        <button
                            type="button"
                            aria-label={`Move ${label} to ${STATUS_NAMES[previous]}`}
                            className={styles.cardButton}
                            onClick={() => setStatus(model, [id], previous)}
                        >
                            <ArrowLeft aria-hidden />
                        </button>
                    )}
                    {next && (
                        <button
                            type="button"
                            aria-label={`Move ${label} to ${STATUS_NAMES[next]}`}
                            className={styles.cardButton}
                            onClick={() => setStatus(model, [id], next)}
                        >
                            <ArrowRight aria-hidden />
                        </button>
                    )}
                </span>
            </div>
        </li>
    );
}

/**
 * The column a tree row is dragged over: `drop-outside-element` is the element under the pointer
 * while a drag is outside the tree (the pointer stays captured by the row, so the column gets no
 * pointer events of its own).
 */
function useColumnUnderDrag(tree: TreeRef<BoardTypes, BoardFeatures>) {
    const engine = tree.current?.engine;
    const subscribe = useCallback(
        (onChange: () => void) => engine?.subscribe(onChange) ?? (() => {}),
        [engine],
    );
    return useSyncExternalStore(
        subscribe,
        () =>
            engine
                ?.get("drop-outside-element")
                ?.closest("[data-status-column]")
                ?.getAttribute("data-status-column") ?? null,
        () => null,
    );
}
