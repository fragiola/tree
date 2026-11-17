import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FixtureTree, files } from "../../src/fixture/tree";
import "../../src/fixture/fixture.css";

// The keyboard fixture: the whole APG key map, type-ahead and rename on an unstyled tree.
// `?dir=rtl` renders it right to left.
const dir = new URLSearchParams(window.location.search).get("dir") ?? "ltr";

const container = document.getElementById("app");
if (!container) throw new Error("no #app");
createRoot(container).render(
    <StrictMode>
        <div dir={dir}>
            <FixtureTree defaultTree={files()} />
        </div>
    </StrictMode>,
);
