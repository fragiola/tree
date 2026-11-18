import type { ItemOf } from "@fragiola/tree-react";
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
} from "lucide-react";
import type { PermissionTypes, Verb } from "./permissions";
import * as styles from "./styles";

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
export function KindIcon({ item }: { item: ItemOf<PermissionTypes> }) {
    if (item.kind === "action") {
        const Icon = VERB_ICONS[item.data.verb];
        return <Icon aria-hidden className={styles.verbIcon} />;
    }
    const Icon =
        item.kind === "organization"
            ? Building2
            : ((item.kind === "area" ? AREA_ICONS : RESOURCE_ICONS)[item.id] ??
              Building);
    return <Icon aria-hidden className={styles.kindIcon[item.kind]} />;
}
