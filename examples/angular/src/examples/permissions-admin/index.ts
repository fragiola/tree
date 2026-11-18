import {
    Component,
    computed,
    DestroyRef,
    type ElementRef,
    inject,
    signal,
    viewChild,
} from "@angular/core";
import {
    createTreeModel,
    type ItemOf,
    injectTreeState,
    TREE,
} from "@fragiola/tree-angular";
import {
    LucideCheck,
    LucideChevronRight,
    LucideLock,
    LucideMinus,
    LucideRotateCcw,
    LucideSave,
    LucideSearch,
    LucideTriangleAlert,
} from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { features } from "./features";
import { KindIcon } from "./kind-icon";
import {
    changesOf,
    describe,
    expand,
    grantedActions,
    grantsOf,
    isRisky,
    keyMap,
    lockRule,
    organization,
    type PermissionTypes,
    ROLE_NAMES,
    roleOf,
    search,
    setGrants,
    toggle,
} from "./permissions";
import * as styles from "./styles";

const json = organization();
let nextInstance = 0;

@Component({
    selector: "example-permissions-admin",
    imports: [
        TREE,
        ClickableButton,
        KindIcon,
        LucideCheck,
        LucideChevronRight,
        LucideLock,
        LucideMinus,
        LucideRotateCcw,
        LucideSave,
        LucideSearch,
        LucideTriangleAlert,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <label [class]="styles.field">
                    <span [class]="styles.fieldLabel">Role</span>
                    <select #roleSelect [class]="styles.select" (change)="chooseRole(roleSelect.value)">
                        @for (name of roles; track name) {
                            <option [value]="name" [selected]="role() === name">{{ name }}</option>
                        }
                        <option value="Custom" disabled [selected]="role() === 'Custom'">Custom</option>
                    </select>
                </label>
                <span [class]="styles.searchField">
                    <svg lucideSearch aria-hidden="true" [class]="styles.searchIcon"></svg>
                    <input
                        #searchInput
                        type="search"
                        aria-label="Search permissions"
                        placeholder="Search"
                        [value]="query()"
                        [class]="styles.search"
                        (input)="onSearch(searchInput.value)"
                    />
                </span>
                @if (query().trim() !== "") {
                    <span [class]="styles.matches" data-testid="matches">
                        {{ found().matchIds.size }} {{ found().matchIds.size === 1 ? "match" : "matches" }}
                    </span>
                }
            </div>
            <div [class]="styles.body">
                <!-- the checks are the app's state, bound both ways, as a form field's value is -->
                <div
                    [treeRoot]="model"
                    [(checkedItemIds)]="checkedItemIds"
                    [keyMap]="keyMap"
                    aria-label="Permissions"
                    [class]="styles.root"
                    (keydown)="onKeyDown($event)"
                >
                    <ng-template [treeItems]="model" let-item>
                        <!-- the search's highlight is the app's: data attributes its styles read -->
                        <div
                            [treeItem]="item"
                            #node="treeItem"
                            [attr.aria-describedby]="descriptionId(item.id)"
                            [attr.data-match]="found().matchIds.has(item.id) ? '' : null"
                            [attr.data-dimmed]="dimmed(item.id) ? '' : null"
                            [class]="styles.item"
                        >
                            <div treeItemContent [class]="styles.row">
                                <span treeToggle [class]="styles.toggle">
                                    <svg lucideChevronRight aria-hidden="true"></svg>
                                </span>
                                <!-- the app's own check control: the item carries aria-checked; Space is the
                                     app's too (keydown on the root); it toggles the actions that are not granted -->
                                <span
                                    aria-hidden="true"
                                    data-tree-no-drag=""
                                    data-testid="check"
                                    [attr.data-checked]="node.state().checked ? '' : null"
                                    [attr.data-indeterminate]="node.state().indeterminate ? '' : null"
                                    [attr.data-disabled]="node.state().disabled ? '' : null"
                                    [class]="styles.checkbox"
                                    (click)="!node.state().disabled && run(item.id)"
                                >
                                    <svg lucideCheck aria-hidden="true" [class]="styles.checkIcon"></svg>
                                    <svg lucideMinus aria-hidden="true" [class]="styles.mixedIcon"></svg>
                                </span>
                                <example-permissions-kind-icon [item]="item" />
                                <span [class]="styles.label">{{ item.label }}</span>
                                <span [id]="descriptionId(item.id)" hidden>{{ description(item, node.state().checked) }}</span>
                                @if (item.kind === "action" && item.data.grantedBy) {
                                    <svg lucideLock aria-hidden="true" [class]="styles.lock"></svg>
                                }
                                @if (isRisky(item)) {
                                    <svg lucideTriangleAlert aria-hidden="true" [class]="styles.risk"></svg>
                                }
                                @if (changeOf(item, node.state().checked); as change) {
                                    <span aria-hidden="true" data-testid="change" [class]="styles.change[change]">
                                        {{ change === "added" ? "+" : "−" }}
                                    </span>
                                }
                            </div>
                            <div treeGroup></div>
                        </div>
                    </ng-template>
                </div>
                <section aria-label="Changes" [class]="styles.summary">
                    <h2 [class]="styles.summaryTitle">Changes</h2>
                    <p [class]="styles.summaryText" data-testid="changes">
                        @if (changes().added.length === 0 && changes().removed.length === 0) {
                            No changes
                        } @else {
                            {{ changes().added.length }} added, {{ changes().removed.length }} removed
                        }
                    </p>
                    <ul [class]="styles.areas">
                        @for (area of changes().byArea; track area.area) {
                            <li [class]="styles.area">
                                <span>{{ area.area }}</span>
                                <span [class]="styles.counts">
                                    @if (area.added > 0) {
                                        <span [class]="styles.added">+{{ area.added }}</span>
                                    }
                                    @if (area.removed > 0) {
                                        <span [class]="styles.removed">−{{ area.removed }}</span>
                                    }
                                </span>
                            </li>
                        }
                    </ul>
                    <div [class]="styles.actions">
                        <button kitClickable variant="outline" size="sm" [disabled]="!changed()" (click)="discard()">
                            <svg lucideRotateCcw aria-hidden="true"></svg>
                            Discard
                        </button>
                        <button kitClickable variant="outline" size="sm" [disabled]="!changed()" (click)="askToSave()">
                            <svg lucideSave aria-hidden="true"></svg>
                            Save
                        </button>
                    </div>
                    <p role="status" data-testid="notice" [class]="styles.notice">{{ notice() }}</p>
                </section>
            </div>
            <dialog #dialog [attr.aria-labelledby]="titleId" [class]="styles.dialog">
                <h2 [id]="titleId" [class]="styles.dialogTitle">Grant risky permissions?</h2>
                <ul [class]="styles.riskyList">
                    @for (change of changes().risky; track change.id) {
                        <li>{{ change.area }} · {{ change.name }}</li>
                    }
                </ul>
                <div [class]="styles.actions">
                    <button kitClickable variant="outline" size="sm" (click)="dialog.close()">Cancel</button>
                    <button kitClickable size="sm" [class]="styles.danger" (click)="save()">Grant and save</button>
                </div>
            </dialog>
        </div>
    `,
})
export default class PermissionsAdmin {
    protected readonly styles = styles;
    protected readonly roles = ROLE_NAMES;
    protected readonly keyMap = keyMap;
    protected readonly isRisky = isRisky;
    // The model is the source of truth: create it once.
    protected readonly model = createTreeModel<
        PermissionTypes,
        typeof features
    >(json, { features });
    /**
     * The checks are the app's state, as a form field's value is: the tree shows them and reports
     * every change it makes; presets and Discard run commands on the model, which reports them. It starts from the model's list,
     * which has the cascade's parents, as every change will.
     */
    protected readonly checkedItemIds = signal<string[]>([
        ...this.model.state.checkedItemIds,
    ]);
    /** what is saved: the granted actions at the last Save */
    protected readonly saved = signal(
        grantedActions(this.model, json.checkedItemIds ?? []),
    );
    protected readonly current = computed(() =>
        grantedActions(this.model, this.checkedItemIds()),
    );
    protected readonly changes = computed(() =>
        changesOf(this.model, this.saved(), this.current()),
    );
    protected readonly changed = computed(
        () => this.changes().added.length + this.changes().removed.length > 0,
    );
    protected readonly role = computed(() => roleOf(this.current()));
    protected readonly query = signal("");
    protected readonly found = injectTreeState(
        (_state, current) => search(current, this.query()),
        { model: this.model },
    );
    private readonly checkedIds = injectTreeState(
        (state) => new Set(state.checkedItemIds),
        {
            model: this.model,
        },
    );
    /** what the rules refused, or what was done */
    protected readonly notice = signal("");
    private readonly instance = nextInstance++;
    protected readonly titleId = `permissions-${this.instance}-dialog-title`;
    private readonly dialog =
        viewChild.required<ElementRef<HTMLDialogElement>>("dialog");

    constructor() {
        inject(DestroyRef).onDestroy(lockRule(this.model));
    }

    protected descriptionId(itemId: string) {
        return `permissions-${this.instance}-description-${itemId}`;
    }

    protected changeOf(
        item: ItemOf<PermissionTypes>,
        checked: boolean,
    ): "added" | "removed" | undefined {
        if (item.kind !== "action") return undefined;
        if (this.saved().includes(item.id) === checked) return undefined;
        return checked ? "added" : "removed";
    }

    protected description(item: ItemOf<PermissionTypes>, checked: boolean) {
        const change = this.changeOf(item, checked);
        return [
            describe(this.model, item, this.checkedIds()),
            change === "added"
                ? "Added"
                : change === "removed"
                  ? "Removed"
                  : "",
        ]
            .filter(Boolean)
            .join(", ");
    }

    protected dimmed(itemId: string) {
        const found = this.found();
        return (
            found.matchIds.size > 0 &&
            !found.matchIds.has(itemId) &&
            !found.aroundIds.has(itemId)
        );
    }

    protected run(itemId: string) {
        this.report(toggle(this.model, itemId));
    }

    private report(result: { ok: boolean; error?: { message: string } }) {
        this.notice.set(result.ok ? "" : (result.error?.message ?? ""));
    }

    protected chooseRole(name: string) {
        if (name !== "Custom")
            this.report(setGrants(this.model, grantsOf(name)));
    }

    protected onSearch(value: string) {
        this.query.set(value);
        // the folders around the matches open
        expand(this.model, search(this.model, value).aroundIds);
    }

    // Space is the app's: the tree's own would uncheck granted actions with their parent
    protected onKeyDown(event: KeyboardEvent) {
        if (event.key !== " " || event.target instanceof HTMLInputElement)
            return;
        const { focusedItemId } = this.model.state;
        if (focusedItemId === null) return;
        event.preventDefault();
        this.run(focusedItemId);
    }

    protected discard() {
        this.report(setGrants(this.model, this.saved()));
        this.notice.set("Discarded.");
    }

    protected save() {
        this.saved.set(this.current());
        this.notice.set("Saved.");
        this.dialog().nativeElement.close();
    }

    // granting a risky action asks first
    protected askToSave() {
        if (this.changes().risky.length > 0)
            this.dialog().nativeElement.showModal();
        else this.save();
    }
}
