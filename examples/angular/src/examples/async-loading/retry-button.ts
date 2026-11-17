import { Component } from "@angular/core";
import { injectTree, injectTreeItem } from "@fragiola/tree-angular";
import { LucideCircleAlert, LucideRotateCcw } from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import type { FileTypes } from "../_kit/data";
import type { features } from "./features";
import * as styles from "./styles";

/** A failed load stays `error` until the app loads it again: a screen action of the engine. */
@Component({
    selector: "example-async-loading-retry-button",
    imports: [ClickableButton, LucideCircleAlert, LucideRotateCcw],
    host: { class: "contents" },
    template: `
        <span [class]="styles.error">
            <svg lucideCircleAlert aria-hidden="true" [class]="styles.errorIcon"></svg>
            <button
                kitClickable
                variant="ghost"
                size="sm"
                [class]="styles.retry"
                [attr.aria-label]="'Retry loading ' + item().label"
                (click)="engine.run('load-children', { itemId: item().id })"
            >
                <svg lucideRotateCcw aria-hidden="true"></svg>
                Retry
            </button>
        </span>
    `,
})
export class RetryButton {
    protected readonly styles = styles;
    // the engine of the enclosing [treeRoot], and the item of the enclosing [treeItem]
    protected readonly engine = injectTree<FileTypes, typeof features>().engine;
    protected readonly item = injectTreeItem<FileTypes>().item;
}
