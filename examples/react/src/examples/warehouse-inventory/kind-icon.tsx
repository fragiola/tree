import type { ItemOf } from "@fragiola/tree-react";
import {
    Box,
    Columns3,
    Flame,
    Package,
    Rows3,
    Snowflake,
    ThermometerSnowflake,
    Undo2,
    Warehouse,
    Wheat,
} from "lucide-react";
import * as styles from "./styles";
import type { Climate, WarehouseTypes } from "./warehouse";

const ZONE_ICONS: Record<Climate, typeof Box> = {
    ambient: Wheat,
    cold: Snowflake,
    frozen: ThermometerSnowflake,
    hazmat: Flame,
    returns: Undo2,
};

/** Each level has its icon; a zone shows its climate, a product what it needs. */
export function KindIcon({ item }: { item: ItemOf<WarehouseTypes> }) {
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
        case "rack":
            return <Rows3 aria-hidden className={styles.icon.location} />;
        case "bin":
            return <Box aria-hidden className={styles.icon.location} />;
        case "product":
            return (
                <Package
                    aria-hidden
                    className={styles.climate[item.data.storage]}
                />
            );
    }
}
