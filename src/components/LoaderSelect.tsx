import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { fetchFabricLoaderVersions } from "@/lib/minecraft-versions";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LoaderSelectProps {
  loader: "vanilla" | "fabric";
  loaderVersion: string;
  mcVersion: string;
  onLoaderChange: (loader: "vanilla" | "fabric") => void;
  onLoaderVersionChange: (version: string) => void;
  error?: string;
}

function LoaderSelect({
  loader,
  loaderVersion,
  mcVersion,
  onLoaderChange,
  onLoaderVersionChange,
  error,
}: LoaderSelectProps) {
  const { t } = useTranslation();
  const [fabricVersions, setFabricVersions] = useState<
    { version: string; stable: boolean }[]
  >([]);
  const [loadingFabric, setLoadingFabric] = useState(false);
  const [fabricError, setFabricError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Fetch Fabric versions when MC version changes
  useEffect(() => {
    if (loader !== "fabric" || !mcVersion) return;

    let cancelled = false;

    async function load() {
      setLoadingFabric(true);
      setFabricError(null);

      try {
        const loaders = await fetchFabricLoaderVersions(mcVersion);
        if (!cancelled) {
          const mapped = loaders.map((l) => ({
            version: l.loader.version,
            stable: l.loader.stable,
          }));
          setFabricVersions(mapped);

          // Auto-select first stable version if none selected
          if (!loaderVersion || !mapped.find((v) => v.version === loaderVersion)) {
            const stable = mapped.find((v) => v.stable);
            if (stable) {
              onLoaderVersionChange(stable.version);
            } else if (mapped.length > 0) {
              onLoaderVersionChange(mapped[0]!.version);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setFabricError(
            err instanceof Error ? err.message : t("loader.failedToLoad"),
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingFabric(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [mcVersion, loader]);

  // Position the dropdown fixed relative to the trigger button
  const updateDropdownPosition = useCallback(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      zIndex: 9999,
    });
  }, [open]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
      updateDropdownPosition();
    }
    if (!open) setSearch("");
  }, [open, updateDropdownPosition]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", updateDropdownPosition, true);
    window.addEventListener("resize", updateDropdownPosition);
    return () => {
      window.removeEventListener("scroll", updateDropdownPosition, true);
      window.removeEventListener("resize", updateDropdownPosition);
    };
  }, [open, updateDropdownPosition]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open]);

  const filteredVersions = fabricVersions.filter((v) =>
    v.version.toLowerCase().includes(search.toLowerCase())
  );

  const canOpen = loader === "fabric" && !loadingFabric && !!mcVersion && !fabricError;
  const selectedVersion = fabricVersions.find((v) => v.version === loaderVersion);

  return (
    <div className="space-y-2" ref={containerRef}>
      <Label htmlFor="loader-version">{t("loader.title")}</Label>

      {/* Loader type buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            onLoaderChange("vanilla");
            onLoaderVersionChange("");
          }}
          className={cn(
            "flex-1 rounded-lg border-2 px-4 py-3 text-left transition-all",
            loader === "vanilla"
              ? "border-primary bg-primary/5"
              : "border-muted bg-card hover:border-muted-foreground/30"
          )}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Vanilla</span>
            {loader === "vanilla" && (
              <Badge variant="default" className="ml-auto text-[10px] px-1.5 py-0">
                Wybrany
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("loader.vanillaDesc")}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onLoaderChange("fabric")}
          className={cn(
            "flex-1 rounded-lg border-2 px-4 py-3 text-left transition-all",
            loader === "fabric"
              ? "border-primary bg-primary/5"
              : "border-muted bg-card hover:border-muted-foreground/30"
          )}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Fabric</span>
            {loader === "fabric" && (
              <Badge variant="default" className="ml-auto text-[10px] px-1.5 py-0">
                Wybrany
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("loader.fabricDesc")}
          </p>
        </button>
      </div>

      {/* Fabric version dropdown */}
      {loader === "fabric" && (
        <div className="mt-2">
          {/* Trigger button */}
          <button
            ref={triggerRef}
            id="loader-version"
            type="button"
            onClick={() => setOpen(!open)}
            disabled={!canOpen}
            className={cn(
              "flex w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-background py-2 pr-2 pl-2.5 text-sm transition-colors outline-none select-none hover:border-ring focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              error && "border-destructive",
              open && "border-ring ring-3 ring-ring/50",
              !canOpen && "cursor-not-allowed opacity-50"
            )}
          >
            <span className="flex-1 text-left truncate">
              {!mcVersion
                ? t("loader.selectMcFirst")
                : loadingFabric
                  ? t("loader.loadingFabric")
                  : fabricError
                    ? t("loader.loadError")
                    : selectedVersion
                      ? selectedVersion.version
                      : t("loader.selectVersion")}
            </span>
            {canOpen && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(
                  "shrink-0 text-muted-foreground transition-transform",
                  open && "rotate-180"
                )}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            )}
          </button>

          {/* Dropdown panel — fixed position to avoid overflow clipping */}
          {open && canOpen && (
            <div style={dropdownStyle}>
              <div className="rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95 overflow-hidden">
                {/* Search input */}
                <div className="p-2 pb-0">
                  <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0 text-muted-foreground"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                      ref={searchRef}
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t("loader.searchPlaceholder")}
                      className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground/60"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="shrink-0 rounded p-0.5 text-muted-foreground/60 hover:text-foreground transition-colors"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Versions list */}
                <div className="max-h-[240px] overflow-y-auto p-1 custom-scrollbar">
                  {filteredVersions.length === 0 ? (
                    <div className="flex flex-col items-center gap-1 py-8 text-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-muted-foreground/40"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                      </svg>
                      <p className="text-xs text-muted-foreground/60">
                        {search
                        ? t("loader.noResultsFor", { search })
                        : t("loader.noResults")}
                      </p>
                    </div>
                  ) : (
                    filteredVersions.map((v) => {
                      const isSelected = v.version === loaderVersion;
                      return (
                        <button
                          key={v.version}
                          type="button"
                          onClick={() => {
                            onLoaderVersionChange(v.version);
                            setOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-left transition-colors",
                            isSelected
                              ? "bg-accent text-accent-foreground font-medium"
                              : "text-popover-foreground hover:bg-accent/60"
                          )}
                        >
                          {isSelected && (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="shrink-0 text-primary"
                            >
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          )}
                          <span className={cn(!isSelected && "pl-[22px]", "flex-1")}>
                            {v.version}
                          </span>
                          {v.stable && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                            >
                              {t("loader.stable")}
                            </Badge>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Footer with count */}
                {filteredVersions.length > 0 && (
                  <div className="border-t border-border/50 px-2.5 py-1.5">
                    <p className="text-[11px] text-muted-foreground/50">
                  {t("version.count", { count: filteredVersions.length })}
                  {search && t("version.filtered", { search })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {fabricError && (
            <p className="mt-1 text-xs text-destructive">{fabricError}</p>
          )}
        </div>
      )}

      {/* Error */}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default LoaderSelect;
