import { Component, computed, input } from "@angular/core";
import type { ItemOf } from "@fragiola/tree-angular";
import {
    LucideBan,
    LucideBuilding,
    LucideBuilding2,
    LucideCreditCard,
    LucideDownload,
    LucideEye,
    LucideFileText,
    LucideFolderGit2,
    LucideGitBranch,
    LucideKey,
    LucideKeyRound,
    LucidePencil,
    LucidePlus,
    LucideRocket,
    LucideSettings,
    LucideShieldAlert,
    LucideShieldCheck,
    LucideTrash2,
    LucideUser,
    LucideUserMinus,
    LucideUserPlus,
    LucideUsers,
    LucideUsersRound,
    LucideWallet,
    LucideWebhook,
} from "@lucide/angular";
import type { PermissionTypes } from "./permissions";
import * as styles from "./styles";

/** The organization, each area and resource has its icon; an action shows its verb. */
@Component({
    selector: "example-permissions-kind-icon",
    imports: [
        LucideBan,
        LucideBuilding,
        LucideBuilding2,
        LucideCreditCard,
        LucideDownload,
        LucideEye,
        LucideFileText,
        LucideFolderGit2,
        LucideGitBranch,
        LucideKey,
        LucideKeyRound,
        LucidePencil,
        LucidePlus,
        LucideRocket,
        LucideSettings,
        LucideShieldAlert,
        LucideShieldCheck,
        LucideTrash2,
        LucideUser,
        LucideUserMinus,
        LucideUserPlus,
        LucideUsers,
        LucideUsersRound,
        LucideWallet,
        LucideWebhook,
    ],
    host: { class: "contents" },
    template: `
        @switch (icon().name) {
            @case ("organization") { <svg lucideBuilding2 aria-hidden="true" [class]="icon().class"></svg> }
            @case ("billing") { <svg lucideCreditCard aria-hidden="true" [class]="icon().class"></svg> }
            @case ("projects") { <svg lucideFolderGit2 aria-hidden="true" [class]="icon().class"></svg> }
            @case ("people") { <svg lucideUsers aria-hidden="true" [class]="icon().class"></svg> }
            @case ("settings") { <svg lucideSettings aria-hidden="true" [class]="icon().class"></svg> }
            @case ("api") { <svg lucideKeyRound aria-hidden="true" [class]="icon().class"></svg> }
            @case ("invoices") { <svg lucideFileText aria-hidden="true" [class]="icon().class"></svg> }
            @case ("payment-methods") { <svg lucideWallet aria-hidden="true" [class]="icon().class"></svg> }
            @case ("repositories") { <svg lucideGitBranch aria-hidden="true" [class]="icon().class"></svg> }
            @case ("deployments") { <svg lucideRocket aria-hidden="true" [class]="icon().class"></svg> }
            @case ("members") { <svg lucideUser aria-hidden="true" [class]="icon().class"></svg> }
            @case ("teams") { <svg lucideUsersRound aria-hidden="true" [class]="icon().class"></svg> }
            @case ("security") { <svg lucideShieldCheck aria-hidden="true" [class]="icon().class"></svg> }
            @case ("tokens") { <svg lucideKey aria-hidden="true" [class]="icon().class"></svg> }
            @case ("webhooks") { <svg lucideWebhook aria-hidden="true" [class]="icon().class"></svg> }
            @case ("verb-read") { <svg lucideEye aria-hidden="true" [class]="icon().class"></svg> }
            @case ("verb-create") { <svg lucidePlus aria-hidden="true" [class]="icon().class"></svg> }
            @case ("verb-update") { <svg lucidePencil aria-hidden="true" [class]="icon().class"></svg> }
            @case ("verb-delete") { <svg lucideTrash2 aria-hidden="true" [class]="icon().class"></svg> }
            @case ("verb-export") { <svg lucideDownload aria-hidden="true" [class]="icon().class"></svg> }
            @case ("verb-admin") { <svg lucideShieldAlert aria-hidden="true" [class]="icon().class"></svg> }
            @case ("verb-invite") { <svg lucideUserPlus aria-hidden="true" [class]="icon().class"></svg> }
            @case ("verb-remove") { <svg lucideUserMinus aria-hidden="true" [class]="icon().class"></svg> }
            @case ("verb-revoke") { <svg lucideBan aria-hidden="true" [class]="icon().class"></svg> }
            @default { <svg lucideBuilding aria-hidden="true" [class]="icon().class"></svg> }
        }
    `,
})
export class KindIcon {
    readonly item = input.required<ItemOf<PermissionTypes>>();

    protected readonly icon = computed(() => {
        const item = this.item();
        if (item.kind === "action")
            return { name: `verb-${item.data.verb}`, class: styles.verbIcon };
        return {
            name: item.kind === "organization" ? "organization" : item.id,
            class: styles.kindIcon[item.kind],
        };
    });
}
