import type { ExampleMeta } from "../meta-types";

export default {
    title: "Tri-state checkboxes",
    description:
        "A permissions picker checked in cascade: a group is checked, unchecked or mixed, and the granted scopes are read from the state.",
    category: "selection",
    order: 2,
    features: ["checkboxes", "Checkbox", "checkMode", "item.toggle-check"],
    docs: "/docs/guides/checkboxes",
} satisfies ExampleMeta;
