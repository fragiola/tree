import type { ExampleMeta } from "../meta-types";

export default {
    title: "Async loading",
    description:
        "Folders whose children come from the app's loader the first time they open, with a loading spinner, a failed load announced, and a retry.",
    category: "data",
    order: 1,
    features: [
        "asyncChildren()",
        "loadChildren",
        "childrenStatus",
        "load-children",
        "announce",
        "LiveRegion",
    ],
    docs: "/docs/guides/async-loading",
} satisfies ExampleMeta;
