// The permissions admin's demo content and app logic, framework-free: an organization's areas,
// resources and actions as a tree document (JSON v1), the role presets, the lock rule as
// middleware, the app's own toggle, the changes against the saved grants, and the search.
import {
    type BatchEntry,
    type ItemOf,
    type KeyMap,
    type TreeJson,
    type TreeModel,
    veto,
} from "@fragiola/tree-react";
import type { PermissionModel } from "./features";

/** What an action does. */
export type Verb =
    | "read"
    | "create"
    | "update"
    | "delete"
    | "export"
    | "admin"
    | "invite"
    | "remove"
    | "revoke";

/** The registry: the organization holds areas, an area resources, a resource its actions. */
export type PermissionTypes = {
    items: {
        organization: undefined;
        area: undefined;
        resource: undefined;
        action: {
            verb: Verb;
            /** what grants it whatever the role: a policy or a group (the action is disabled) */
            grantedBy: string | null;
        };
    };
};

type Item = ItemOf<PermissionTypes>;
type Action = Extract<Item, { kind: "action" }>;

/** The verbs that change or expose a lot: granting one asks first. */
export const RISKY: ReadonlySet<Verb> = new Set([
    "delete",
    "export",
    "admin",
    "remove",
    "revoke",
]);

export const isRisky = (item: Item) =>
    item.kind === "action" && RISKY.has(item.data.verb);

const VERB_LABELS: Record<Verb, string> = {
    read: "Read",
    create: "Create",
    update: "Update",
    delete: "Delete",
    export: "Export",
    admin: "Administer",
    invite: "Invite",
    remove: "Remove",
    revoke: "Revoke",
};

const AREAS: {
    id: string;
    label: string;
    resources: { id: string; label: string; verbs: Verb[] }[];
}[] = [
    {
        id: "billing",
        label: "Billing",
        resources: [
            {
                id: "invoices",
                label: "Invoices",
                verbs: ["read", "export", "delete"],
            },
            {
                id: "payment-methods",
                label: "Payment methods",
                verbs: ["read", "update", "delete"],
            },
        ],
    },
    {
        id: "projects",
        label: "Projects",
        resources: [
            {
                id: "repositories",
                label: "Repositories",
                verbs: ["read", "create", "update", "delete", "admin"],
            },
            {
                id: "deployments",
                label: "Deployments",
                verbs: ["read", "create", "admin"],
            },
        ],
    },
    {
        id: "people",
        label: "People",
        resources: [
            {
                id: "members",
                label: "Members",
                verbs: ["read", "invite", "remove", "admin"],
            },
            {
                id: "teams",
                label: "Teams",
                verbs: ["read", "create", "update"],
            },
        ],
    },
    {
        id: "settings",
        label: "Settings",
        resources: [
            {
                id: "organization",
                label: "Organization",
                verbs: ["read", "update"],
            },
            {
                id: "security",
                label: "Security",
                verbs: ["read", "update", "admin"],
            },
        ],
    },
    {
        id: "api",
        label: "API",
        resources: [
            {
                id: "tokens",
                label: "Tokens",
                verbs: ["read", "create", "revoke"],
            },
            {
                id: "webhooks",
                label: "Webhooks",
                verbs: ["read", "create", "delete"],
            },
        ],
    },
];

/** The actions granted whatever the role, and by what. */
const GRANTED: Record<string, string> = {
    "members-read": "the security policy",
    "security-read": "the security policy",
    "repositories-read": "the security policy",
    "deployments-read": "the Engineering group",
};

/** The roles, as the actions they grant (the granted ones come on top). */
export const ROLES: Record<string, readonly string[]> = {
    Viewer: AREAS.flatMap((area) =>
        area.resources.map((resource) => `${resource.id}-read`),
    ),
    Editor: [
        ...AREAS.flatMap((area) =>
            area.resources.map((resource) => `${resource.id}-read`),
        ),
        "repositories-create",
        "repositories-update",
        "deployments-create",
        "teams-create",
        "teams-update",
        "webhooks-create",
    ],
    "Billing manager": [
        "invoices-read",
        "invoices-export",
        "payment-methods-read",
        "payment-methods-update",
        "organization-read",
    ],
    Admin: AREAS.flatMap((area) =>
        area.resources.flatMap((resource) =>
            resource.verbs.map((verb) => `${resource.id}-${verb}`),
        ),
    ),
};

export const ROLE_NAMES = Object.keys(ROLES);

/** The organization, the Editor's grants checked (and the granted actions, always). */
export function organization(): TreeJson<PermissionTypes> {
    const items: TreeJson<PermissionTypes>["items"] = {
        acme: {
            kind: "organization",
            label: "Acme Inc.",
            childItemIds: AREAS.map((area) => area.id),
        },
    };
    for (const area of AREAS) {
        items[area.id] = {
            kind: "area",
            label: area.label,
            childItemIds: area.resources.map((resource) => resource.id),
        };
        for (const resource of area.resources) {
            items[resource.id] = {
                kind: "resource",
                label: resource.label,
                childItemIds: resource.verbs.map(
                    (verb) => `${resource.id}-${verb}`,
                ),
            };
            for (const verb of resource.verbs) {
                const id = `${resource.id}-${verb}`;
                const grantedBy = GRANTED[id] ?? null;
                items[id] = {
                    kind: "action",
                    label: VERB_LABELS[verb],
                    data: { verb, grantedBy },
                    // granted whatever the role: focusable, not actionable
                    ...(grantedBy ? { disabled: true } : {}),
                };
            }
        }
    }
    return {
        version: 1,
        rootItemIds: ["acme"],
        items,
        expandedItemIds: ["acme", "billing", "projects", "repositories"],
        checkedItemIds: grantsOf("Editor"),
        settings: { checkMode: "cascade" },
    };
}

/** A role's actions, with the granted ones. */
export function grantsOf(role: string): string[] {
    return [...new Set([...(ROLES[role] ?? []), ...Object.keys(GRANTED)])];
}

/**
 * Space is the app's here, not the tree's: the tree's own toggle would uncheck granted actions
 * along with their parent (the cascade does not skip disabled items). Workaround: see
 * docs/docs-examples-gaps.md.
 */
export const keyMap: Partial<KeyMap> = { toggle: [] };

/** The actions under an item (itself, for an action). */
export function actionsOf(
    model: TreeModel<PermissionTypes>,
    itemId: string,
): Action[] {
    const item = model.get("item-by", { id: itemId });
    if (!item) return [];
    if (item.kind === "action") return [item];
    return (item.childItemIds ?? []).flatMap((childId) =>
        actionsOf(model, childId),
    );
}

const isGranted = (item: Item | undefined) =>
    item?.kind === "action" && item.data.grantedBy !== null;

/**
 * The lock rule, as one middleware: no check may uncheck a granted action, directly or through
 * its resource, area or organization (the cascade). The app's toggle checks the actions one by
 * one, so it never asks; a script that does is told why.
 */
export function lockRule(model: PermissionModel) {
    return model.use((ctx, next) => {
        if (ctx.command !== "item.check" && ctx.command !== "item.toggle-check")
            return next();
        const { itemId } = ctx.payload;
        const unchecking =
            ctx.command === "item.check"
                ? !ctx.payload.checked
                : model.get("check-state-by", { itemId }) === "checked";
        if (!unchecking) return next();
        const granted = actionsOf(model, itemId).find((action) =>
            isGranted(action),
        );
        if (granted) {
            const resource = ctx.get("item-parent-by", { itemId: granted.id });
            return veto(
                `${resource?.label ?? ""} ${granted.label.toLowerCase()} is granted by ${granted.data.grantedBy}.`,
            );
        }
        return next();
    });
}

/**
 * The app's toggle (its check control and Space): an unchecked or mixed item gets all its actions,
 * a checked one loses them, the granted ones kept. One step: the cascade settles the parents.
 */
export function toggle(model: PermissionModel, itemId: string) {
    const checked = model.get("check-state-by", { itemId }) === "checked";
    const actions = actionsOf(model, itemId).filter(
        (action) => !isGranted(action),
    );
    return model.run("batch", {
        commands: actions.map(
            (action): BatchEntry<PermissionTypes> => ({
                command: "item.check",
                payload: { itemId: action.id, checked: !checked },
            }),
        ),
    });
}

/**
 * One step that sets the grants to exactly these actions (a role preset, Discard): each action
 * that is not granted anyway is checked or unchecked, and the cascade settles the parents. The
 * tree reports the new list, so the app's controlled `checkedItemIds` follows. Workaround: setting
 * the controlled list itself can lose checks (see docs/docs-examples-gaps.md).
 */
export function setGrants(
    model: PermissionModel,
    actionIds: readonly string[],
) {
    const wanted = new Set(actionIds);
    return model.run("batch", {
        commands: Object.values(model.state.items).flatMap(
            (item): BatchEntry<PermissionTypes>[] =>
                item.kind === "action" && !isGranted(item)
                    ? [
                          {
                              command: "item.check",
                              payload: {
                                  itemId: item.id,
                                  checked: wanted.has(item.id),
                              },
                          },
                      ]
                    : [],
        ),
    });
}

/** The checked actions among `checkedItemIds` (a checked parent is a shortcut for them). */
export function grantedActions(
    model: TreeModel<PermissionTypes>,
    checkedItemIds: readonly string[],
) {
    const ids = new Set(checkedItemIds);
    return Object.values(model.state.items)
        .filter((item) => item.kind === "action" && ids.has(item.id))
        .map((item) => item.id);
}

/** The role whose grants are exactly these, or Custom. */
export function roleOf(actionIds: readonly string[]) {
    const current = [...actionIds].sort().join();
    return (
        ROLE_NAMES.find((role) => grantsOf(role).sort().join() === current) ??
        "Custom"
    );
}

/** What changed since the last save: the actions added and removed, by area. */
export function changesOf(
    model: TreeModel<PermissionTypes>,
    saved: readonly string[],
    current: readonly string[],
) {
    const before = new Set(saved);
    const after = new Set(current);
    const added = current.filter((id) => !before.has(id));
    const removed = saved.filter((id) => !after.has(id));
    const describe = (id: string) => {
        const action = model.get("item-by", { id });
        const resource = model.get("item-parent-by", { itemId: id });
        const area =
            resource && model.get("item-parent-by", { itemId: resource.id });
        return {
            id,
            area: area?.label ?? "",
            name: `${resource?.label ?? ""}: ${action?.label ?? id}`,
            risky: action ? isRisky(action) : false,
        };
    };
    const byArea = new Map<string, { added: number; removed: number }>();
    for (const [list, key] of [
        [added, "added"],
        [removed, "removed"],
    ] as const) {
        for (const id of list) {
            const { area } = describe(id);
            const counts = byArea.get(area) ?? { added: 0, removed: 0 };
            counts[key]++;
            byArea.set(area, counts);
        }
    }
    return {
        added: added.map(describe),
        removed: removed.map(describe),
        byArea: [...byArea].map(([area, counts]) => ({ area, ...counts })),
        /** the risky actions being granted: saving asks first */
        risky: added.map(describe).filter((change) => change.risky),
    };
}

/** The items whose label matches a search, and the folders around them (to expand). */
export function search(model: TreeModel<PermissionTypes>, query: string) {
    const needle = query.trim().toLowerCase();
    const matchIds = new Set<string>();
    const aroundIds = new Set<string>();
    if (needle === "") return { matchIds, aroundIds };
    for (const item of Object.values(model.state.items)) {
        if (
            item.kind === "organization" ||
            !item.label.toLowerCase().includes(needle)
        )
            continue;
        matchIds.add(item.id);
        let parent = model.get("item-parent-by", { itemId: item.id });
        while (parent) {
            aroundIds.add(parent.id);
            parent = model.get("item-parent-by", { itemId: parent.id });
        }
    }
    return { matchIds, aroundIds };
}

/** One step that expands these items (the ones not expanded yet). */
export function expand(
    model: TreeModel<PermissionTypes>,
    itemIds: Iterable<string>,
) {
    return model.run("batch", {
        commands: [...itemIds]
            .filter((itemId) => !model.is("item-expanded", { itemId }))
            .map(
                (itemId): BatchEntry<PermissionTypes> => ({
                    command: "item.expand",
                    payload: { itemId },
                }),
            ),
    });
}

/** A row's description: why a granted action is checked, a risky one's warning, a parent's count. */
export function describe(
    model: TreeModel<PermissionTypes>,
    item: Item,
    checkedIds: ReadonlySet<string>,
) {
    if (item.kind === "action") {
        const parts: string[] = [];
        if (item.data.grantedBy)
            parts.push(`Granted by ${item.data.grantedBy}`);
        if (isRisky(item)) parts.push("Risky");
        return parts.join(", ");
    }
    const actions = actionsOf(model, item.id);
    return `${actions.filter((action) => checkedIds.has(action.id)).length} of ${actions.length} granted`;
}
