import { Component, computed, input } from "@angular/core";
import type { ItemOf } from "@fragiola/tree-angular";
import {
    LucideBox,
    LucideColumns3,
    LucideFlame,
    LucidePackage,
    LucideRows3,
    LucideSnowflake,
    LucideThermometerSnowflake,
    LucideUndo2,
    LucideWarehouse,
    LucideWheat,
} from "@lucide/angular";
import * as styles from "./styles";
import type { WarehouseTypes } from "./warehouse";

/** Each level has its icon; a zone shows its climate, a product what it needs. */
@Component({
    selector: "example-warehouse-kind-icon",
    imports: [
        LucideBox,
        LucideColumns3,
        LucideFlame,
        LucidePackage,
        LucideRows3,
        LucideSnowflake,
        LucideThermometerSnowflake,
        LucideUndo2,
        LucideWarehouse,
        LucideWheat,
    ],
    host: { class: "contents" },
    template: `
        @switch (icon().name) {
            @case ("site") { <svg lucideWarehouse aria-hidden="true" [class]="icon().class"></svg> }
            @case ("ambient") { <svg lucideWheat aria-hidden="true" [class]="icon().class"></svg> }
            @case ("cold") { <svg lucideSnowflake aria-hidden="true" [class]="icon().class"></svg> }
            @case ("frozen") { <svg lucideThermometerSnowflake aria-hidden="true" [class]="icon().class"></svg> }
            @case ("hazmat") { <svg lucideFlame aria-hidden="true" [class]="icon().class"></svg> }
            @case ("returns") { <svg lucideUndo2 aria-hidden="true" [class]="icon().class"></svg> }
            @case ("aisle") { <svg lucideColumns3 aria-hidden="true" [class]="icon().class"></svg> }
            @case ("rack") { <svg lucideRows3 aria-hidden="true" [class]="icon().class"></svg> }
            @case ("product") { <svg lucidePackage aria-hidden="true" [class]="icon().class"></svg> }
            @default { <svg lucideBox aria-hidden="true" [class]="icon().class"></svg> }
        }
    `,
})
export class KindIcon {
    readonly item = input.required<ItemOf<WarehouseTypes>>();

    protected readonly icon = computed(() => {
        const item = this.item();
        switch (item.kind) {
            case "site":
                return { name: "site", class: styles.icon.site };
            case "zone":
                return {
                    name: item.data.climate,
                    class: styles.climate[item.data.climate],
                };
            case "product":
                return {
                    name: "product",
                    class: styles.climate[item.data.storage],
                };
            default:
                return { name: item.kind, class: styles.icon.location };
        }
    });
}
