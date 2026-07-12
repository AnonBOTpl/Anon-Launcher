import { lazy, Suspense } from "react";
import { ITEM_ICONS } from "@/lib/instanceIcon";
import { cn } from "@/lib/utils";
import type { ComponentType, SVGProps } from "react";

interface IconPickerProps {
  value?: string; // "item:diamond" or undefined
  onChange: (iconId: string) => void;
  /**
   * If true, shows a "Random" button that clears the selection (hash-based default).
   */
  showRandom?: boolean;
}

// Lazy-loaded icon components
const iconLoaders = ITEM_ICONS.map((item) => ({
  ...item,
  loader: lazy(() =>
    import("minecraft-items-react").then((m) => {
      const name = item.component as keyof typeof m;
      const Component = m[name] as unknown as ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
      return { default: Component };
    })
  ),
}));

function IconPicker({ value, onChange, showRandom = true }: IconPickerProps) {
  const selectedId = value?.startsWith("item:") ? value.slice(5) : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {ITEM_ICONS.map((item) => {
          const isSelected = selectedId === item.id;
          const Loader = iconLoaders.find((l) => l.id === item.id)!.loader;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(`item:${item.id}`)}
              title={item.label}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg border transition-all",
                isSelected
                  ? "border-primary bg-primary/15 ring-1 ring-primary/30"
                  : "border-border/50 bg-card hover:border-foreground/20 hover:bg-accent",
              )}
            >
              <Suspense
                fallback={
                  <div className="h-5 w-5 rounded bg-muted/50" />
                }
              >
                <Loader size={20} />
              </Suspense>
            </button>
          );
        })}
      </div>

      {showRandom && (
        <button
          type="button"
          onClick={() => onChange("")}
          className={cn(
            "text-xs transition-all rounded-md px-2 py-1",
            selectedId === null
              ? "text-primary font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          🎲 Random (auto)
        </button>
      )}
    </div>
  );
}

export default IconPicker;
