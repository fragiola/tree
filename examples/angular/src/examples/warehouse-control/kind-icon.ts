import { Component, computed, input } from "@angular/core";
import type { ItemOf } from "@fragiola/tree-angular";
import {
    LucideBox,
    LucideColumns3,
    LucideFlame,
    LucideSnowflake,
    LucideThermometerSnowflake,
    LucideUndo2,
    LucideWarehouse,
    LucideWheat,
} from "@lucide/angular";
import * as styles from "./styles";
import type { ControlTypes } from "./warehouse";

/** Each level has its icon; a zone shows its climate, a bin what its product needs. */
@Component({
    selector: "example-control-kind-icon",
    imports: [
        LucideBox,
        LucideColumns3,
        LucideFlame,
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
            @default { <svg lucideBox aria-hidden="true" [class]="icon().class"></svg> }
        }
    `,
})
export class KindIcon {
    readonly item = input.required<ItemOf<ControlTypes>>();

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
            case "aisle":
                return { name: "aisle", class: styles.icon.location };
            case "bin":
                return {
                    name: "bin",
                    class: styles.climate[item.data.storage],
                };
        }
    });
}
