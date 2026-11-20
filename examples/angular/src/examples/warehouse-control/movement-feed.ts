import { Component, computed, input } from "@angular/core";
import { LucideArrowDownToLine, LucideArrowUpFromLine } from "@lucide/angular";
import { formatTime } from "../_kit/warehouse-live";
import * as styles from "./styles";
import { type ControlModel, type LiveLog, movementsIn } from "./warehouse";

const SHOWN = 7;

let nextInstance = 0;

/** The scope's last stock movements, newest first. */
@Component({
    selector: "example-control-movement-feed",
    imports: [LucideArrowDownToLine, LucideArrowUpFromLine],
    host: { class: "contents" },
    template: `
        <section [attr.aria-labelledby]="titleId" [class]="styles.panel">
            <h2 [id]="titleId" [class]="styles.panelTitle">Stock movements</h2>
            @if (movements().length === 0) {
                <p [class]="styles.empty">No movement yet.</p>
            } @else {
                <ol [attr.aria-labelledby]="titleId" [class]="styles.feed">
                    @for (movement of movements(); track movement.id) {
                        <li [class]="styles.movement">
                            <span [class]="styles.movementTime">{{ formatTime(movement.time) }}</span>
                            @if (movement.kind === "pick") {
                                <svg lucideArrowUpFromLine aria-hidden="true" [class]="styles.movementIcon(movement.kind)"></svg>
                            } @else {
                                <svg lucideArrowDownToLine aria-hidden="true" [class]="styles.movementIcon(movement.kind)"></svg>
                            }
                            <span [class]="styles.srOnly">{{ movement.kind === "pick" ? "Pick" : "Receipt" }}</span>
                            <span [class]="styles.movementBin">{{ movement.bin }}</span>
                            <span [class]="styles.movementDelta(movement.kind)">{{ movement.change }}</span>
                        </li>
                    }
                </ol>
            }
        </section>
    `,
})
export class MovementFeed {
    protected readonly styles = styles;
    protected readonly formatTime = formatTime;
    protected readonly titleId = `warehouse-control-feed-${nextInstance++}`;
    readonly model = input.required<ControlModel>();
    readonly log = input.required<LiveLog>();
    readonly scopeId = input.required<string>();
    protected readonly movements = computed(() => {
        const model = this.model();
        return movementsIn(model, this.log(), this.scopeId())
            .slice(0, SHOWN)
            .map((movement) => {
                const bin = model.get("item-by", { id: movement.binId });
                return {
                    ...movement,
                    bin: `${bin?.label ?? movement.binId}${bin?.kind === "bin" ? ` · ${bin.data.product}` : ""}`,
                    change:
                        movement.delta > 0
                            ? `+${movement.delta}`
                            : `−${-movement.delta}`,
                };
            });
    });
}
