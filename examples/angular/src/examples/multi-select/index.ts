import { Component, computed } from "@angular/core";
import {
    createTreeModel,
    injectTreeState,
    TREE,
    type TreeStateOf,
} from "@fragiola/tree-angular";
import {
    type SelectionFeature,
    selection,
} from "@fragiola/tree-angular/selection";
import { LucideChevronRight, LucideUserRound } from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { type OrgTypes, orgChart } from "../_kit/data";
import * as styles from "./styles";

/** The state of a model with the selection feature. */
type Selected = TreeStateOf<OrgTypes, readonly [SelectionFeature]>;

// The kit's organization chart has `settings.selectionMode: "multiple"`: a click selects one
// person, Ctrl/⌘ + click adds or removes one, Shift + click selects the range from the last one.

let nextId = 0;

@Component({
    selector: "example-multi-select",
    imports: [TREE, LucideChevronRight, LucideUserRound, ClickableButton],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <p role="status" data-testid="selection-count" [class]="styles.count">
                    {{ names().length === 0 ? "Nobody selected" : names().length + " selected" }}
                </p>
                <button
                    kitClickable
                    variant="outline"
                    size="sm"
                    (click)="model.run('tree.select-all', {})"
                >
                    Select all
                </button>
                <button
                    kitClickable
                    variant="outline"
                    size="sm"
                    [disabled]="names().length === 0"
                    (click)="model.run('tree.clear-selection', {})"
                >
                    Clear selection
                </button>
            </div>
            <div [treeRoot]="model" aria-label="Organization" [class]="styles.root">
                <ng-template [treeItems]="model" let-item>
                    <!-- the role describes the person; the name alone is the item's accessible name -->
                    <div [treeItem]="item" [attr.aria-describedby]="roleId(item.id)" [class]="styles.item">
                        <div treeItemContent [class]="styles.row">
                            <span treeToggle [class]="styles.toggle">
                                <svg lucideChevronRight aria-hidden="true"></svg>
                            </span>
                            <svg lucideUserRound aria-hidden="true" [class]="styles.icon"></svg>
                            <span [class]="styles.label">{{ item.label }}</span>
                            <span [id]="roleId(item.id)" aria-hidden="true" [class]="styles.role">
                                {{ item.data.role }}
                            </span>
                        </div>
                        <div treeGroup></div>
                    </div>
                </ng-template>
            </div>
            <p data-testid="selection-names" [class]="styles.names">
                {{
                    names().length === 0
                        ? "Ctrl/⌘ + click adds a person, Shift + click selects a range."
                        : names().join(", ")
                }}
            </p>
        </div>
    `,
})
export default class MultiSelect {
    protected readonly styles = styles;
    // the app owns the model, so the summary outside the root can read it
    protected readonly model = createTreeModel<
        OrgTypes,
        readonly [SelectionFeature]
    >(orgChart(), { features: [selection()] });
    // the selected ids keep their identity until the selection changes: no extra render
    private readonly selectedItemIds = injectTreeState<
        OrgTypes,
        readonly string[]
    >((state) => (state as Selected).selectedItemIds, { model: this.model });
    protected readonly names = computed(() =>
        this.selectedItemIds().map(
            (itemId) =>
                this.model.get("item-by", { id: itemId })?.label ?? itemId,
        ),
    );
    private readonly idPrefix = `multi-select-${nextId++}`;

    protected roleId(itemId: string): string {
        return `${this.idPrefix}-role-${itemId}`;
    }
}
