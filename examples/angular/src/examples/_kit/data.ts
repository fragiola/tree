// The demo content the examples share: plain tree documents (JSON v1) and their registries. No
// tree assembly and no styles: each example renders its own tree.
import type { TreeJson } from "@fragiola/tree-angular";

/** A file system: folders hold files; a file knows its size. */
export type FileTypes = {
    items: { folder: undefined; file: { size: number } };
};

/** A small project, `src` expanded. */
export function fileSystem(): TreeJson<FileTypes> {
    return {
        version: 1,
        rootItemIds: ["src", "public", "package", "readme"],
        items: {
            src: {
                kind: "folder",
                label: "src",
                childItemIds: ["components", "hooks", "app", "main"],
            },
            components: {
                kind: "folder",
                label: "components",
                childItemIds: ["button", "dialog", "tree-view"],
            },
            button: { kind: "file", label: "button.tsx", data: { size: 1840 } },
            dialog: { kind: "file", label: "dialog.tsx", data: { size: 4210 } },
            "tree-view": {
                kind: "file",
                label: "tree-view.tsx",
                data: { size: 6020 },
            },
            hooks: {
                kind: "folder",
                label: "hooks",
                childItemIds: ["use-theme"],
            },
            "use-theme": {
                kind: "file",
                label: "use-theme.ts",
                data: { size: 730 },
            },
            app: { kind: "file", label: "app.tsx", data: { size: 2480 } },
            main: { kind: "file", label: "main.tsx", data: { size: 310 } },
            public: {
                kind: "folder",
                label: "public",
                childItemIds: ["favicon", "robots"],
            },
            favicon: {
                kind: "file",
                label: "favicon.svg",
                data: { size: 920 },
            },
            robots: { kind: "file", label: "robots.txt", data: { size: 24 } },
            package: {
                kind: "file",
                label: "package.json",
                data: { size: 1130 },
            },
            readme: { kind: "file", label: "README.md", data: { size: 3400 } },
        },
        expandedItemIds: ["src"],
    };
}

/** `1840` → `1.8 KB`. */
export function formatSize(bytes: number): string {
    return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

/** Permissions: groups of permissions, checked in cascade. */
export type PermissionTypes = {
    items: { group: undefined; permission: { scope: string } };
};

export function permissions(): TreeJson<PermissionTypes> {
    const permission = (label: string, scope: string) =>
        ({ kind: "permission", label, data: { scope } }) as const;
    return {
        version: 1,
        settings: { selectionMode: "none", checkMode: "cascade" },
        rootItemIds: ["content", "members", "billing"],
        items: {
            content: {
                kind: "group",
                label: "Content",
                childItemIds: ["read", "write", "publish"],
            },
            read: permission("Read pages", "content:read"),
            write: permission("Edit pages", "content:write"),
            publish: permission("Publish pages", "content:publish"),
            members: {
                kind: "group",
                label: "Members",
                childItemIds: ["invite", "remove"],
            },
            invite: permission("Invite members", "members:invite"),
            remove: permission("Remove members", "members:remove"),
            billing: {
                kind: "group",
                label: "Billing",
                childItemIds: ["invoices", "plan"],
            },
            invoices: permission("See invoices", "billing:read"),
            plan: permission("Change the plan", "billing:write"),
        },
        expandedItemIds: ["content", "members", "billing"],
        checkedItemIds: ["read", "write"],
    };
}

/** An organization chart: every item is a person with a role. */
export type OrgTypes = { items: { person: { role: string } } };

export function orgChart(): TreeJson<OrgTypes> {
    const person = (label: string, role: string, childItemIds?: string[]) => ({
        kind: "person" as const,
        label,
        data: { role },
        ...(childItemIds ? { childItemIds } : {}),
    });
    return {
        version: 1,
        settings: { selectionMode: "multiple" },
        rootItemIds: ["ada"],
        items: {
            ada: person("Ada Lovelace", "Chief executive", [
                "grace",
                "alan",
                "katherine",
            ]),
            grace: person("Grace Hopper", "Engineering", ["linus", "margaret"]),
            linus: person("Linus Torvalds", "Platform"),
            margaret: person("Margaret Hamilton", "Reliability"),
            alan: person("Alan Turing", "Research", ["barbara"]),
            barbara: person("Barbara Liskov", "Languages"),
            katherine: person("Katherine Johnson", "Operations", ["dorothy"]),
            dorothy: person("Dorothy Vaughan", "Computing"),
        },
        expandedItemIds: ["ada", "grace", "alan", "katherine"],
    };
}
