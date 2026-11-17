// A fake server for the async examples: an app's `loadChildren` fetches an item's children from
// its back-end; this one answers from memory after a delay, and can fail. Copy the shape, not the
// fake: `loadChildren(item, { signal })` returns the children as item JSON, and aborts on `signal`.
import type { LoadChildren, TreeItemJson } from "@fragiola/tree-vue";
import type { FileTypes } from "./data";

/** What the fake server holds: each folder's children, by the folder's id. */
const SERVER: Record<string, TreeItemJson<FileTypes>[]> = {
    photos: [
        {
            id: "2024",
            kind: "folder",
            label: "2024",
            childrenStatus: "unloaded",
        },
        {
            id: "2025",
            kind: "folder",
            label: "2025",
            childrenStatus: "unloaded",
        },
        {
            id: "cover",
            kind: "file",
            label: "cover.jpg",
            data: { size: 182000 },
        },
    ],
    "2024": [
        {
            id: "beach",
            kind: "file",
            label: "beach.jpg",
            data: { size: 240000 },
        },
        { id: "hike", kind: "file", label: "hike.jpg", data: { size: 310000 } },
    ],
    "2025": [
        { id: "city", kind: "file", label: "city.jpg", data: { size: 205000 } },
    ],
    documents: [
        { id: "cv", kind: "file", label: "cv.pdf", data: { size: 98000 } },
        {
            id: "taxes",
            kind: "folder",
            label: "taxes",
            childrenStatus: "unloaded",
        },
    ],
    taxes: [
        {
            id: "return",
            kind: "file",
            label: "return.pdf",
            data: { size: 51000 },
        },
    ],
    archive: [],
};

export interface FakeLoaderOptions {
    /** how long (ms) a load takes */
    latency?: number;
    /** the folders whose first load fails (a retry succeeds) */
    failOnce?: readonly string[];
}

/** A `loadChildren` over the fake server. */
export function createFakeLoader(
    options: FakeLoaderOptions = {},
): LoadChildren<FileTypes> {
    const { latency = 600 } = options;
    const failing = new Set(options.failOnce);
    return (item, { signal }) =>
        new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                if (failing.delete(item.id)) {
                    reject(
                        new Error(
                            `could not reach the server for ${item.label}`,
                        ),
                    );
                } else {
                    resolve(SERVER[item.id] ?? []);
                }
            }, latency);
            signal.addEventListener("abort", () => {
                clearTimeout(timer);
                reject(signal.reason);
            });
        });
}
