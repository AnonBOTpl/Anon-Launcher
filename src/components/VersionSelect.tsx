import { useState, useEffect, useRef, useCallback } from "react";
import { fetchMinecraftVersions, type MinecraftVersion } from "@/lib/minecraft-versions";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface VersionSelectProps {
  value: string;
  onChange: (version: string) => void;
  error?: string;
}

type TabType = "release" | "snapshot";

function VersionSelect({ value, onChange, error }: VersionSelectProps) {
  const [versions, setVersions] = useState<MinecraftVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabType>("release");
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch versions on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setFetchError(null);

      try {
        const all = await fetchMinecraftVersions();
        if (!cancelled) {
          setVersions(all);
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : "Failed to load versions");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

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
    // Reset search when closing
    if (!open) {
      setSearch("");
    }
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

  const filteredVersions = versions
    .filter((v) => v.type === tab)
    .filter((v) => v.id.toLowerCase().includes(search.toLowerCase()));


  return (
    <div className="space-y-2" ref={containerRef}>
      <Label htmlFor="mc-version">Wersja Minecraft</Label>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg bg-muted p-0.5">
        <button
          type="button"
          onClick={() => { setTab("release"); setSearch(""); }}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "release"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Wydania
        </button>
        <button
          type="button"
          onClick={() => { setTab("snapshot"); setSearch(""); }}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "snapshot"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Snapshoty
        </button>
      </div>

      {/* Trigger button */}
      <button
        ref={triggerRef}
        id="mc-version"
        type="button"
        onClick={() => setOpen(!open)}
        disabled={loading || !!fetchError}
        className={cn(
          "flex w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-background py-2 pr-2 pl-2.5 text-sm transition-colors outline-none select-none hover:border-ring focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          error && "border-destructive",
          open && "border-ring ring-3 ring-ring/50",
          (loading || !!fetchError) && "cursor-not-allowed opacity-50"
        )}
      >
        <span className="flex-1 text-left truncate">
          {loading
            ? "Ładowanie wersji..."
            : fetchError
              ? "Błąd ładowania"
              : value || "Wybierz wersję"}
        </span>
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
      </button>

      {/* Dropdown panel — fixed position to avoid overflow clipping */}
      {open && (
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
                  placeholder="Szukaj wersji..."
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
            <div
              ref={listRef}
              className="max-h-[240px] overflow-y-auto p-1 custom-scrollbar"
            >
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
                      ? `Brak wersji "${search}"`
                      : "Brak wersji do wyświetlenia"}
                  </p>
                </div>
              ) : (
                filteredVersions.map((v) => {
                  const isSelected = v.id === value;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        onChange(v.id);
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
                      <span className={cn(!isSelected && "pl-[22px]")}>
                        {v.id}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer with count */}
            {filteredVersions.length > 0 && (
              <div className="border-t border-border/50 px-2.5 py-1.5">
                <p className="text-[11px] text-muted-foreground/50">
                  {filteredVersions.length} wersji
                  {search && ` (filtrowano: "${search}")`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
      {fetchError && (
        <p className="text-xs text-destructive">
          Nie udało się załadować wersji. Sprawdź połączenie z internetem.
        </p>
      )}
    </div>
  );
}

export default VersionSelect;
