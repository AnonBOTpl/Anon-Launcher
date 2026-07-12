import { cn } from "@/lib/utils";
import type { InstanceManifest } from "@/types/instance";
import { getInstanceIconMeta } from "@/lib/instanceIcon";
import {
  MinecraftDiamond,
  MinecraftDiamondSword,
  MinecraftDiamondChestplate,
  MinecraftPotion,
  MinecraftBlazeRod,
  MinecraftBone,
  MinecraftBow,
  MinecraftDiamondPickaxe,
  MinecraftApple,
  MinecraftEnderPearl,
  MinecraftBrick,
  MinecraftNetherStar,
  MinecraftBook,
  MinecraftDiamondHelmet,
  MinecraftGoldIngot,
  MinecraftTrident,
} from "minecraft-items-react";
import type { ComponentType, SVGProps } from "react";

// Statically imported icon components — no lazy loading, no flickering
const iconComponents: Record<string, ComponentType<SVGProps<SVGSVGElement> & { size?: number }>> = {
  diamond: MinecraftDiamond,
  sword: MinecraftDiamondSword,
  shield: MinecraftDiamondChestplate,
  potion: MinecraftPotion,
  blaze: MinecraftBlazeRod,
  bone: MinecraftBone,
  bow: MinecraftBow,
  pickaxe: MinecraftDiamondPickaxe,
  apple: MinecraftApple,
  pearl: MinecraftEnderPearl,
  brick: MinecraftBrick,
  star: MinecraftNetherStar,
  book: MinecraftBook,
  helmet: MinecraftDiamondHelmet,
  ingot: MinecraftGoldIngot,
  trident: MinecraftTrident,
};

interface InstanceIconProps {
  instance: Pick<InstanceManifest, "name" | "icon">;
  size?: number;
  className?: string;
}

function InstanceIcon({ instance, size = 24, className }: InstanceIconProps) {
  const meta = getInstanceIconMeta(instance);

  // URL-based icon (modpack import)
  if (meta.type === "url") {
    return (
      <img
        src={meta.src}
        alt={meta.label}
        className={cn("rounded object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  // Minecraft item icon — statically imported, no flickering
  const IconComponent = iconComponents[meta.id];

  if (!IconComponent) {
    // Fallback: first letter
    return (
      <div
        className={cn("flex items-center justify-center rounded bg-muted text-sm font-bold text-muted-foreground", className)}
        style={{ width: size, height: size }}
      >
        {instance.name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return <IconComponent size={size} />;
}

export default InstanceIcon;


