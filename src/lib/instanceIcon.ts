import type { InstanceManifest } from "@/types/instance";

/**
 * Iconic Minecraft items used as instance icons.
 * Each item maps to a minecraft-items-react component name.
 */
export const ITEM_ICONS = [
  { id: "diamond", label: "Diamond", component: "MinecraftDiamond" },
  { id: "sword", label: "Sword", component: "MinecraftDiamondSword" },
  { id: "shield", label: "Shield", component: "MinecraftDiamondChestplate" },
  { id: "potion", label: "Potion", component: "MinecraftPotion" },
  { id: "blaze", label: "Blaze Rod", component: "MinecraftBlazeRod" },
  { id: "bone", label: "Bone", component: "MinecraftBone" },
  { id: "bow", label: "Bow", component: "MinecraftBow" },
  { id: "pickaxe", label: "Pickaxe", component: "MinecraftDiamondPickaxe" },
  { id: "apple", label: "Apple", component: "MinecraftApple" },
  { id: "pearl", label: "Ender Pearl", component: "MinecraftEnderPearl" },
  { id: "brick", label: "Brick", component: "MinecraftBrick" },
  { id: "star", label: "Nether Star", component: "MinecraftNetherStar" },
  { id: "book", label: "Book", component: "MinecraftBook" },
  { id: "helmet", label: "Helmet", component: "MinecraftDiamondHelmet" },
  { id: "ingot", label: "Gold Ingot", component: "MinecraftGoldIngot" },
  { id: "trident", label: "Trident", component: "MinecraftTrident" },
] as const;

export type ItemIconId = (typeof ITEM_ICONS)[number]["id"];

/**
 * Simple string hash — always returns same value for same input.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Pick an item icon ID deterministically from an instance name.
 */
export function hashToItemId(name: string): ItemIconId {
  const index = hashString(name) % ITEM_ICONS.length;
  return ITEM_ICONS[index]!.id;
}

/**
 * Get the icon metadata for an instance.
 * Priority: 1. User-set icon, 2. URL from modpack, 3. Hash-based default.
 */
export function getInstanceIconMeta(instance: Pick<InstanceManifest, "name" | "icon">) {
  const raw = instance.icon;

  // URL-based icon (from Modrinth import)
  if (raw?.startsWith("url:")) {
    return {
      type: "url" as const,
      src: raw.slice(4),
      id: "url",
      label: instance.name,
    };
  }

  // User-selected item icon
  if (raw?.startsWith("item:")) {
    const id = raw.slice(5);
    const found = ITEM_ICONS.find((i) => i.id === id);
    if (found) {
      return {
        type: "item" as const,
        id: found.id,
        label: found.label,
        component: found.component,
      };
    }
  }

  // Default: hash-based
  const hashed = ITEM_ICONS[hashString(instance.name) % ITEM_ICONS.length]!;
  return {
    type: "item" as const,
    id: hashed.id,
    label: hashed.label,
    component: hashed.component,
  };
}

/**
 * Get the icon identifier to store in the manifest.
 */
export function getIconIdentifier(iconType: "item" | "url", value: string): string {
  if (iconType === "url") return `url:${value}`;
  return `item:${value}`;
}
