import { createTreeModel, type TreeJson, veto } from "@fragiola/tree-react";
import { useState } from "react";
import { StyledTree } from "../../fixture/styled";
import { useInspector } from "../../inspector/context";

// Drops refused three ways: an item that is not movable, a folder that is not droppable, and a
// middleware veto (nothing moves into "archive"). Refused targets show no indicator. The
// Inspector is on: open State to watch data-drop-target and data-drop-position while dragging.

type Types = { items: { folder: undefined; file: undefined } };

const json: TreeJson<Types> = {
    version: 1,
    rootItemIds: ["inbox", "pinned", "archive", "readme"],
    items: {
        inbox: { kind: "folder", label: "inbox", childItemIds: ["a", "b"] },
        a: { kind: "file", label: "a.txt" },
        b: { kind: "file", label: "b.txt (locked)", movable: false },
        pinned: {
            kind: "folder",
            label: "pinned (no drops)",
            childItemIds: ["c"],
            droppable: false,
        },
        c: { kind: "file", label: "c.txt" },
        archive: {
            kind: "folder",
            label: "archive (vetoed)",
            childItemIds: [],
        },
        readme: { kind: "file", label: "readme.md" },
    },
    expandedItemIds: ["inbox", "pinned"],
};

export default function LockedFolders() {
    const [model] = useState(() => {
        const created = createTreeModel<Types>(json);
        created.use((ctx, next) =>
            ctx.command === "item.move" &&
            (ctx.payload as { to: { parentItemId: string | null } }).to
                .parentItemId === "archive"
                ? veto("archive is read-only")
                : next(),
        );
        return created;
    });
    useInspector(model);
    return <StyledTree<Types> model={model} />;
}
