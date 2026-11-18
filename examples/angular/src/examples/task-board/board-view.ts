import { Component, computed, effect, input, signal } from "@angular/core";
import {
    injectTreeState,
    type TreeRootDirective,
} from "@fragiola/tree-angular";
import { LucideArrowLeft, LucideArrowRight } from "@lucide/angular";
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
@Component({
    selector: "example-task-board-columns",
    imports: [LucideArrowLeft, LucideArrowRight],
    host: { class: "contents" },
    template: `
        <section aria-label="Board" [class]="styles.board">
            <h2 [class]="styles.boardTitle">{{ scope() }}</h2>
            <div [class]="styles.columns">
                @for (column of columns(); track column.status) {
                    <section
                        [attr.aria-label]="names[column.status]"
                        [attr.data-status-column]="column.status"
                        [attr.data-over]="over() === column.status ? '' : null"
                        [class]="styles.column"
                    >
                        <h3 [class]="styles.columnTitle">
                            {{ names[column.status] }}
                            <span>{{ column.cards.length }}</span>
                        </h3>
                        <ul [class]="styles.cards">
                            @if (column.cards.length === 0) {
                                <li [class]="styles.empty">Drop a task here</li>
                            }
                            @for (card of column.cards; track card.id) {
                                <li data-testid="card" [class]="styles.card">
                                    {{ card.label }}
                                    <div [class]="styles.cardMeta">
                                        <span [class]="styles.cardPerson">{{ card.person }}</span>
                                        @if (card.progress !== "") {
                                            <span [class]="styles.cardProgress">{{ card.progress }}</span>
                                        }
                                        <span [class]="styles.cardActions">
                                            @if (column.previous; as previous) {
                                                <button
                                                    type="button"
                                                    [attr.aria-label]="'Move ' + card.label + ' to ' + names[previous]"
                                                    [class]="styles.cardButton"
                                                    (click)="move(card.id, previous)"
                                                >
                                                    <svg lucideArrowLeft aria-hidden="true"></svg>
                                                </button>
                                            }
                                            @if (column.next; as next) {
                                                <button
                                                    type="button"
                                                    [attr.aria-label]="'Move ' + card.label + ' to ' + names[next]"
                                                    [class]="styles.cardButton"
                                                    (click)="move(card.id, next)"
                                                >
                                                    <svg lucideArrowRight aria-hidden="true"></svg>
                                                </button>
                                            }
                                        </span>
                                    </div>
                                </li>
                            }
                        </ul>
                    </section>
                }
            </div>
        </section>
    `,
})
export class BoardView {
    protected readonly styles = styles;
    protected readonly names = STATUS_NAMES;
    readonly model = input.required<BoardModel>();
    readonly root =
        input.required<TreeRootDirective<BoardTypes, BoardFeatures>>();
    private readonly state = injectTreeState((state) => state, {
        model: this.model,
    });
    protected readonly scope = computed(() => {
        this.state();
        return scopeOf(this.model())?.label ?? "";
    });
    protected readonly columns = computed(() => {
        this.state();
        const model = this.model();
        return columnsOf(model).map(({ status, cards }) => ({
            status,
            ...neighbours(status),
            cards: cards.map((card) => {
                const { done, total } = progressOf(model, card.id);
                const assigneeId =
                    card.kind === "task" ? card.data.assigneeId : null;
                return {
                    id: card.id,
                    label: card.label,
                    person:
                        PEOPLE.find((person) => person.id === assigneeId)
                            ?.name ?? "Unassigned",
                    progress: total > 1 ? `${done}/${total} done` : "",
                };
            }),
        }));
    });
    /**
     * The column a tree row is dragged over: `drop-outside-element` is the element under the
     * pointer while a drag is outside the tree (the pointer stays captured by the row, so the
     * column gets no pointer events of its own).
     */
    protected readonly over = signal<string | null>(null);

    constructor() {
        effect((onCleanup) => {
            const { engine } = this.root();
            onCleanup(
                engine.subscribe(() =>
                    this.over.set(
                        engine
                            .get("drop-outside-element")
                            ?.closest("[data-status-column]")
                            ?.getAttribute("data-status-column") ?? null,
                    ),
                ),
            );
        });
    }

    protected move(itemId: string, status: Status) {
        setStatus(this.model(), [itemId], status);
    }
}
