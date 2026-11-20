import type { ItemOf } from "@fragiola/tree-react";
import {
    Box,
    Columns3,
    Flame,
    Snowflake,
    ThermometerSnowflake,
    Undo2,
    Warehouse,
    Wheat,
} from "lucide-react";
import * as styles from "./styles";
import type { Climate, ControlTypes } from "./warehouse";

const ZONE_ICONS: Record<Climate, typeof Box> = {
    ambient: Wheat,
    cold: Snowflake,
    frozen: ThermometerSnowflake,
    hazmat: Flame,
    returns: Undo2,
};

/** Each level has its icon; a zone shows its climate, a bin what its product needs. */
export function KindIcon({ item }: { item: ItemOf<ControlTypes> }) {
    switch (item.kind) {
        case "site":
            return <Warehouse aria-hidden className={styles.icon.site} />;
        case "zone": {
            const Icon = ZONE_ICONS[item.data.climate];
            return (
                <Icon
                    aria-hidden
                    className={styles.climate[item.data.climate]}
                />
            );
        }
        case "aisle":
            return <Columns3 aria-hidden className={styles.icon.location} />;
        case "bin":
            return (
                <Box
                    aria-hidden
                    className={styles.climate[item.data.storage]}
                />
            );
    }
}
