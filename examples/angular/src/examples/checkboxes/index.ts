import { Component, computed } from "@angular/core";
import { createTreeModel, injectTreeState, TREE } from "@fragiola/tree-angular";
import { LucideCheck, LucideChevronRight, LucideMinus } from "@lucide/angular";
import { type PermissionTypes, permissions } from "../_kit/data";
import * as styles from "./styles";

// The kit's permissions are checked in cascade (`settings.checkMode: "cascade"`): checking a group
// checks its permissions, and a group with only some of them checked is mixed. `checkboxes` puts
// `aria-checked` on every item, and makes Space toggle the focused item's check.

@Component({
    selector: "example-checkboxes",
    imports: [TREE, LucideCheck, LucideChevronRight, LucideMinus],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [treeRoot]="model" checkboxes aria-label="Permissions" [class]="styles.root">
                <ng-template [treeItems]="model" let-item>
                    <div [treeItem]="item" #node="treeItem" [class]="styles.item">
                        <div treeItemContent [class]="styles.row">
                            <span treeToggle [class]="styles.toggle">
                                <svg lucideChevronRight aria-hidden="true"></svg>
                            </span>
                            <!-- the app's own check control: a press toggles the item's check
                                 (item.toggle-check, with the cascade); it shows a check mark, or a
                                 dash when mixed. The item already carries aria-checked and Space
                                 toggles it, so the box is a span hidden from assistive technology
                                 that never takes focus (a press focuses the item, and the arrows
                                 keep working); data-tree-no-drag keeps a press from dragging or
                                 selecting -->
                            <span
                                aria-hidden="true"
                                data-tree-no-drag
                                data-testid="check"
                                [attr.data-checked]="node.state().checked ? '' : null"
                                [attr.data-indeterminate]="node.state().indeterminate ? '' : null"
                                [attr.data-disabled]="node.state().disabled ? '' : null"
                                [class]="styles.checkbox"
                                (click)="model.run('item.toggle-check', { itemId: item.id })"
                            >
                                <svg lucideCheck aria-hidden="true" [class]="styles.checkIcon"></svg>
                                <svg lucideMinus aria-hidden="true" [class]="styles.mixedIcon"></svg>
                            </span>
                            <span [class]="styles.label">{{ item.label }}</span>
                        </div>
                        <div treeGroup></div>
                    </div>
                </ng-template>
            </div>
            <section aria-label="Granted scopes" [class]="styles.readout">
                <h2 [class]="styles.readoutTitle">Granted scopes</h2>
                <ul data-testid="scopes" [class]="styles.scopes">
                    @for (scope of scopeList(); track scope) {
                        <li [class]="styles.scope">{{ scope }}</li>
                    } @empty {
                        <li [class]="styles.empty">None</li>
                    }
                </ul>
            </section>
        </div>
    `,
})
export default class Checkboxes {
    protected readonly styles = styles;
    protected readonly model = createTreeModel<PermissionTypes>(permissions());
    // the scopes the app would save: the checked permissions (a group is only a shortcut)
    private readonly scopes = injectTreeState<PermissionTypes, string>(
        (state) =>
            state.checkedItemIds
                .flatMap((itemId) => {
                    const item = state.items[itemId];
                    return item?.kind === "permission" ? [item.data.scope] : [];
                })
                .join(" "),
        { model: this.model },
    );
    protected readonly scopeList = computed(() =>
        this.scopes() === "" ? [] : this.scopes().split(" "),
    );
}
