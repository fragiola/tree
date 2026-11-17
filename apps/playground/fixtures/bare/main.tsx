import { Tree } from "@fragiola/tree-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { files, Item, type Types } from "../../src/fixture/tree";
import "../../src/fixture/fixture.css";

// The bare fixture: the minimal tree, with no feature installed. It renders, navigates, expands
// and collapses, and keeps one roving tab stop; it selects nothing and says nothing about a
// selection (no `aria-selected`, no `aria-multiselectable`).

// the fixtures' document without its selection mode: a field of a feature this tree does not have
const { settings: _selection, ...json } = files();

const container = document.getElementById("app");
if (!container) throw new Error("no #app");
createRoot(container).render(
    <StrictMode>
        <Tree.Root<Types> aria-label="Files" defaultTree={json}>
            <Tree.Items<Types>>{(item) => <Item item={item} />}</Tree.Items>
            <Tree.LiveRegion />
        </Tree.Root>
    </StrictMode>,
);
