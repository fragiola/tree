import { createTreeModel, type TreeJson } from "@fragiola/tree-react";
import {
    type SelectionFeature,
    selection,
} from "@fragiola/tree-react/selection";
import { useState } from "react";
import { StyledTree } from "../../fixture/styled";

// A big tree with no virtualization (this release has none): 20 folders of 10 folders of 10
// files, 2,220 items, every folder expanded. Expand, collapse, select and drag to feel the cost.

type Types = { items: { folder: undefined; file: undefined } };

function big(): TreeJson<Types> {
    const json: TreeJson<Types> = {
        version: 1,
        settings: { selectionMode: "multiple" },
        rootItemIds: [],
        items: {},
        expandedItemIds: [],
    };
    for (let a = 0; a < 20; a++) {
        const top = `f${a}`;
        json.rootItemIds.push(top);
        const children: string[] = [];
        for (let b = 0; b < 10; b++) {
            const folder = `${top}-${b}`;
            const files: string[] = [];
            for (let c = 0; c < 10; c++) {
                const file = `${folder}-${c}`;
                files.push(file);
                json.items[file] = {
                    kind: "file",
                    label: `file ${a}.${b}.${c}`,
                };
            }
            json.items[folder] = {
                kind: "folder",
                label: `folder ${a}.${b}`,
                childItemIds: files,
            };
            children.push(folder);
            json.expandedItemIds?.push(folder);
        }
        json.items[top] = {
            kind: "folder",
            label: `group ${a}`,
            childItemIds: children,
        };
        json.expandedItemIds?.push(top);
    }
    return json;
}

export default function Stress() {
    const [model] = useState(() =>
        createTreeModel<Types, readonly [SelectionFeature]>(big(), {
            features: [selection()],
        }),
    );
    return <StyledTree<Types> model={model} />;
}
