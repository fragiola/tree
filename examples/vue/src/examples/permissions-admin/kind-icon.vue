<script setup lang="ts">
import type { ItemOf } from "@fragiola/tree-vue";
import {
    Ban,
    Building,
    Building2,
    CreditCard,
    Download,
    Eye,
    FileText,
    FolderGit2,
    GitBranch,
    Key,
    KeyRound,
    Pencil,
    Plus,
    Rocket,
    Settings,
    ShieldAlert,
    ShieldCheck,
    Trash2,
    User,
    UserMinus,
    UserPlus,
    Users,
    UsersRound,
    Wallet,
    Webhook,
} from "@lucide/vue";
import { computed } from "vue";
import type { PermissionTypes, Verb } from "./permissions";
import * as styles from "./styles";

const props = defineProps<{ item: ItemOf<PermissionTypes> }>();

const AREA_ICONS: Record<string, typeof Eye> = {
    billing: CreditCard,
    projects: FolderGit2,
    people: Users,
    settings: Settings,
    api: KeyRound,
};

const RESOURCE_ICONS: Record<string, typeof Eye> = {
    invoices: FileText,
    "payment-methods": Wallet,
    repositories: GitBranch,
    deployments: Rocket,
    members: User,
    teams: UsersRound,
    organization: Building,
    security: ShieldCheck,
    tokens: Key,
    webhooks: Webhook,
};

const VERB_ICONS: Record<Verb, typeof Eye> = {
    read: Eye,
    create: Plus,
    update: Pencil,
    delete: Trash2,
    export: Download,
    admin: ShieldAlert,
    invite: UserPlus,
    remove: UserMinus,
    revoke: Ban,
};

/** The organization, each area and resource has its icon; an action shows its verb. */
const icon = computed(() => {
    const item = props.item;
    if (item.kind === "action")
        return {
            component: VERB_ICONS[item.data.verb],
            class: styles.verbIcon,
        };
    return {
        component:
            item.kind === "organization"
                ? Building2
                : ((item.kind === "area" ? AREA_ICONS : RESOURCE_ICONS)[
                      item.id
                  ] ?? Building),
        class: styles.kindIcon[item.kind],
    };
});
</script>

<template>
    <component :is="icon.component" aria-hidden="true" :class="icon.class" />
</template>
