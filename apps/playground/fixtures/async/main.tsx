import type { LoadChildren } from "@fragiola/tree-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FixtureTree, files, type Types } from "../../src/fixture/tree";
import "../../src/fixture/fixture.css";

// The async loading fixture: `lib` comes from the loader. The test drives the loader from the
// page: `window.loads` holds each pending load, which it resolves or rejects itself.

type Pending = {
    itemId: string;
    resolve: (labels: string[]) => void;
    reject: (message: string) => void;
};

declare global {
    interface Window {
        loads: Pending[];
    }
}
window.loads = [];

const loadChildren: LoadChildren<Types> = (item) =>
    new Promise((resolve, reject) => {
        window.loads.push({
            itemId: item.id,
            resolve: (labels) =>
                resolve(
                    labels.map((label) => ({
                        id: `${item.id}-${label}`,
                        kind: "file" as const,
                        label,
                    })),
                ),
            reject: (message) => reject(new Error(message)),
        });
    });

const container = document.getElementById("app");
if (!container) throw new Error("no #app");
createRoot(container).render(
    <StrictMode>
        <FixtureTree
            defaultTree={files(true)}
            loadChildren={loadChildren}
            announce={(event) =>
                event.type === "load-error"
                    ? `${event.itemId} failed to load`
                    : undefined
            }
        />
    </StrictMode>,
);
