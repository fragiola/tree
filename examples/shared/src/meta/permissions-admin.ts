import type { ExampleMeta } from "../meta-types";

export default {
    title: "Permissions admin",
    description:
        "A role's permissions over an organization's resources: cascade checks, role presets, actions locked by policy, the changes against the saved grants, search, and a confirmation for risky grants.",
    category: "apps",
    order: 4,
    features: [
        "typed data",
        "checkboxes() cascade",
        "controlled checkedItemIds",
        "disabled",
        "keyMap",
        "model.use veto",
        "batch",
        "check-state-by",
    ],
    docs: "/docs/guides/checkboxes",
} satisfies ExampleMeta;
