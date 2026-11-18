import { Component, DestroyRef, inject, signal } from "@angular/core";
import {
    type AnnounceEvent,
    createTreeModel,
    type ItemOf,
    injectTreeState,
    TREE,
} from "@fragiola/tree-angular";
import { TreeDropIndicatorDirective } from "@fragiola/tree-angular/drag-and-drop";
import { TreeVirtualItemsDirective } from "@fragiola/tree-angular/virtualization";
import {
    LucideChevronRight,
    LucideChevronsDownUp,
    LucideListChecks,
    LucideTriangleAlert,
} from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { Details } from "./details";
import { features, type WarehouseModel } from "./features";
import { KindIcon } from "./kind-icon";
import * as styles from "./styles";
import {
    expandToLowStock,
    formatUnits,
    STORAGE_NAMES,
    stockTotals,
    storageRules,
    type WarehouseTypes,
    warehouse,
    zoneOf,
} from "./warehouse";

const ZONE_OPTIONS = [
    { id: "", label: "All zones" },
    { id: "dry", label: "Dry goods" },
    { id: "cold", label: "Cold storage" },
    { id: "frozen", label: "Freezer" },
    { id: "hazmat", label: "Hazmat cage" },
    { id: "returns", label: "Returns" },
];

let nextInstance = 0;

@Component({
    selector: "example-warehouse-inventory",
    imports: [
        TREE,
        TreeDropIndicatorDirective,
        TreeVirtualItemsDirective,
        ClickableButton,
        Details,
        KindIcon,
        LucideChevronRight,
        LucideChevronsDownUp,
        LucideListChecks,
        LucideTriangleAlert,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <button kitClickable variant="outline" size="sm" (click)="expandToLowStock(model)">
                    <svg lucideListChecks aria-hidden="true"></svg>
                    Expand to low stock
                </button>
                <button kitClickable variant="outline" size="sm" (click)="model.run('tree.collapse-all', {})">
                    <svg lucideChevronsDownUp aria-hidden="true"></svg>
                    Collapse all
                </button>
                <select #zoneSelect aria-label="Highlight zone" [class]="styles.select" (change)="zoneId.set(zoneSelect.value)">
                    @for (zone of zones; track zone.id) {
                        <option [value]="zone.id" [selected]="zoneId() === zone.id">{{ zone.label }}</option>
                    }
                </select>
                <span [class]="styles.lowCount" data-testid="low-stock">
                    <svg lucideTriangleAlert aria-hidden="true"></svg>
                    {{ totals().lowProductIds.length }} low on stock
                </span>
            </div>
            <div [class]="styles.body">
                <div
                    [treeRoot]="model"
                    #tree="treeRoot"
                    [announce]="announce"
                    aria-label="Warehouse locations"
                    [class]="styles.root"
                >
                    <!-- flat rows: each item carries its level, position and set size; no treeGroup.
                         The zone highlight is the app's: a data attribute its styles read -->
                    <ng-template [treeVirtualItems]="model" let-item>
                        <div
                            [treeItem]="item"
                            [attr.aria-describedby]="stockId(item.id)"
                            [attr.data-dimmed]="inZone(item.id) ? null : ''"
                            [class]="styles.item"
                        >
                            <div treeItemContent [class]="styles.row">
                                <span treeToggle [class]="styles.toggle">
                                    <svg lucideChevronRight aria-hidden="true"></svg>
                                </span>
                                <example-warehouse-kind-icon [item]="item" />
                                <span [class]="styles.label">{{ item.label }}</span>
                                <span [id]="stockId(item.id)" hidden>{{ describe(item) }}</span>
                                @if (item.kind === "bin") {
                                    <span aria-hidden="true" [class]="styles.fill">
                                        <span [class]="styles.fillBar(ratio(item))" [style.width.%]="ratio(item) * 100"></span>
                                    </span>
                                } @else {
                                    <span aria-hidden="true" [class]="styles.units">{{ formatUnits(unitsOf(item.id)) }}</span>
                                }
                                @if (flagged(item)) {
                                    <span aria-hidden="true" [class]="styles.low">
                                        <svg lucideTriangleAlert></svg>
                                        @if (item.kind !== "product") {
                                            {{ lowOf(item.id) }}
                                        }
                                    </span>
                                }
                            </div>
                        </div>
                    </ng-template>
                    @if (tree.state().dragging) {
                        <div treeDropIndicator [class]="styles.dropIndicator"></div>
                    }
                    <div treeLiveRegion [class]="styles.liveRegion"></div>
                </div>
                <example-warehouse-details [model]="model" />
            </div>
        </div>
    `,
})
export default class WarehouseInventory {
    protected readonly styles = styles;
    protected readonly zones = ZONE_OPTIONS;
    protected readonly formatUnits = formatUnits;
    protected readonly expandToLowStock = expandToLowStock;
    // The model is the source of truth: create it once.
    protected readonly model = createTreeModel<WarehouseTypes, typeof features>(
        warehouse(),
        { features },
    );
    protected readonly announce = announcer(this.model);
    /** the zone the app highlights: its rows stay, the others dim (the tree is not filtered) */
    protected readonly zoneId = signal("");
    /** the stock of every item, derived once per state */
    protected readonly totals = injectTreeState(
        (_state, current) => stockTotals(current),
        { model: this.model },
    );
    private readonly instance = nextInstance++;

    constructor() {
        inject(DestroyRef).onDestroy(storageRules(this.model));
    }

    // the stock describes the row; the label alone is its accessible name
    protected stockId(itemId: string) {
        return `warehouse-${this.instance}-stock-${itemId}`;
    }

    protected unitsOf(itemId: string) {
        return this.totals().byItemId.get(itemId)?.units ?? 0;
    }

    protected lowOf(itemId: string) {
        return this.totals().byItemId.get(itemId)?.low ?? 0;
    }

    protected ratio(item: ItemOf<WarehouseTypes>) {
        return item.kind === "bin"
            ? Math.min(1, this.unitsOf(item.id) / item.data.capacity)
            : 0;
    }

    protected inZone(itemId: string) {
        const zoneId = this.zoneId();
        this.totals();
        return zoneId === "" || zoneOf(this.model, itemId)?.id === zoneId;
    }

    protected flagged(item: ItemOf<WarehouseTypes>) {
        return item.kind === "product"
            ? item.data.quantity < item.data.minimum
            : this.lowOf(item.id) > 0;
    }

    protected describe(item: ItemOf<WarehouseTypes>) {
        const units = this.unitsOf(item.id);
        if (item.kind === "product") {
            const low = item.data.quantity < item.data.minimum;
            return `${formatUnits(units)} units${low ? `, low stock (minimum ${item.data.minimum})` : ""}, needs ${STORAGE_NAMES[item.data.storage]}`;
        }
        if (item.kind === "bin")
            return `${Math.round((units / item.data.capacity) * 100)}% full, ${formatUnits(units)} of ${item.data.capacity} units`;
        const low = this.lowOf(item.id);
        return `${formatUnits(units)} units${low ? `, ${low} low on stock` : ""}`;
    }
}

/** The live region's text: each step of a drag, and why nothing takes a product here. */
function announcer(model: WarehouseModel) {
    const label = (itemId: string | null) =>
        itemId === null
            ? "the warehouse"
            : (model.get("item-by", { id: itemId })?.label ?? itemId);
    const needs = (itemIds: readonly string[]) => {
        const item = model.get("item-by", { id: itemIds[0] ?? "" });
        return item?.kind === "product"
            ? ` It needs ${STORAGE_NAMES[item.data.storage]}.`
            : "";
    };
    return (event: AnnounceEvent): string | undefined => {
        switch (event.type) {
            case "drag-start":
                return `Picked up ${event.itemIds.map(label).join(", ")}.${needs(event.itemIds)}`;
            case "drag-over":
                return event.target
                    ? event.target.position === "inside"
                        ? `Drop into ${label(event.target.itemId)}.`
                        : `Drop ${event.target.position} ${label(event.target.itemId)}.`
                    : `No bin here takes it.${needs(event.itemIds)}`;
            case "drop":
                return `Moved ${event.itemIds.map(label).join(", ")}.`;
            case "drag-cancel":
                return "Move cancelled.";
            default:
                return undefined;
        }
    };
}
