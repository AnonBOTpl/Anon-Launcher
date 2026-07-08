import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAccounts } from "@/hooks/useAccounts";
import { useAuth } from "@/hooks/useAuth";
import * as accountsApi from "@/lib/accounts";
import { getAvatarUrl, getBodyUrl } from "@/lib/minecraft-avatar";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function AccountSwitcher() {
  const { t } = useTranslation();
  const { accounts, activeAccount, switchAccount, loading, removeAccount, refresh } = useAccounts();
  const { startLogin, flowState, session } = useAuth();
  const [open, setOpen] = useState(false);
  const [sidebarImgError, setSidebarImgError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Reset on account switch
  useEffect(() => {
    setSidebarImgError(false);
  }, [activeAccount?.uuid]);

  const handleSwitch = async (uuid: string) => {
    await switchAccount(uuid);
    // Don't close dialog — user can see the profile update
  };

  const handleAddAccount = () => {
    setOpen(false);
    startLogin();
  };

  const handleLogout = async () => {
    if (activeAccount) {
      await removeAccount(activeAccount.uuid);
      setOpen(false);
    }
  };

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  // Gdy auth flow zakończy się sukcesem — zapisz konto
  useEffect(() => {
    if (flowState.step === "done" && session) {
      Promise.allSettled([
        accountsApi.saveAccount(session),
        accountsApi.saveAccountSession(session),
      ]).then(async () => {
        await accountsApi.setActiveAccount(session.uuid).catch((err) =>
          console.warn("Failed to set active account:", err)
        );
        refresh();
      });
    }
  }, [flowState.step, session, refresh]);

  return (
    <>
      {/* Sidebar button — shows actual avatar thumbnail when logged in */}
      <button
        onClick={() => setOpen(true)}
        title={activeAccount ? activeAccount.username : t("accounts.title")}
        className="group relative flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-accent cursor-pointer overflow-hidden"
      >
        {activeAccount && !sidebarImgError ? (
          <img
            src={`${getAvatarUrl(activeAccount.uuid, 36)}?t=${refreshKey}`}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setSidebarImgError(true)}
          />
        ) : (
          <span className="text-xs font-bold">
            {activeAccount?.username?.charAt(0).toUpperCase() ?? "?"}
          </span>
        )}
        {/* Online status dot */}
        <span
          className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar-background ${
            activeAccount
              ? "bg-emerald-500"
              : "bg-muted-foreground/30"
          }`}
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="sr-only">{t("accounts.title")}</DialogTitle>

          {/* ─── Profile Preview Section ─────────────────────────── */}
          {activeAccount ? (
            <div className="flex flex-col items-center pt-4 pb-2">
              {/* Full body render — główny wizualny element profilu */}
              <div className="flex justify-center">
                <img
                  src={`${getBodyUrl(activeAccount.uuid)}?t=${refreshKey}`}
                  alt={`Skin ${activeAccount.username}`}
                  className="h-48 w-auto object-contain"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.src = "https://mc-heads.net/body/steve";
                  }}
                />
              </div>

              {/* Player info */}
              <div className="mt-3 text-center">
                <h2 className="text-lg font-semibold">{activeAccount.username}</h2>
                <p className="mt-0.5 text-[10px] font-mono text-muted-foreground">
                  {activeAccount.uuid}
                </p>
                <div className="mt-1.5 flex items-center justify-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {t("accounts.online")}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{t("accounts.microsoft")}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRefresh}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M21 2v6h-6" />
                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                    <path d="M3 12a9 9 0 0 0 15 6.7L21 16" />
                  </svg>
                  {t("accounts.refresh")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleLogout}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  {t("accounts.logout")}
                </Button>
              </div>
            </div>
          ) : (
            /* No account signed in */
            <div className="flex flex-col items-center py-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50">
                  <circle cx="12" cy="8" r="5" />
                  <path d="M20 21a8 8 0 1 0-16 0" />
                </svg>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{t("accounts.notLoggedIn")}</p>
              <p className="text-xs text-muted-foreground/60">{t("accounts.notLoggedInHint")}</p>
            </div>
          )}

          {/* ─── Divider ─────────────────────────────────────────── */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              {t("accounts.title")}
            </span>
            <div className="flex-1 h-px bg-border/50" />
          </div>

          {/* ─── Accounts List ───────────────────────────────────── */}
          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar -mx-1 px-1">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-purple-500" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                {t("accounts.noAccounts")}
              </div>
            ) : (
              accounts.map((account) => (
                <button
                  key={account.uuid}
                  onClick={() => handleSwitch(account.uuid)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    account.isActive
                      ? "bg-purple-500/15 text-purple-300"
                      : "text-foreground hover:bg-accent",
                  )}
                >
                  {/* Mini avatar */}
                  <img
                    src={`${getAvatarUrl(account.uuid, 32)}?t=${refreshKey}`}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-lg object-cover ring-1 ring-border/50"
                    onError={(e) => {
                      // Hide image and show letter fallback
                      e.currentTarget.style.display = "none";
                      const fallback = e.currentTarget.parentElement?.querySelector(".account-fallback");
                      if (fallback) (fallback as HTMLElement).classList.remove("hidden");
                    }}
                  />
                  <span className="account-fallback hidden flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold bg-muted text-muted-foreground">
                    {account.username.charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 text-left min-w-0">
                    <div className="truncate font-medium">
                      {account.username}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {t("accounts.microsoft")}
                    </div>
                  </div>
                  {account.isActive && (
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
                      className="text-purple-400 shrink-0"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>

          {/* ─── Add Account Button ──────────────────────────────── */}
          <div className="pt-2">
            <Button
              onClick={handleAddAccount}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white shadow-lg shadow-purple-500/20"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="mr-2"
              >
                <rect x="2" y="2" width="9" height="9" />
                <rect x="13" y="2" width="9" height="9" />
                <rect x="2" y="13" width="9" height="9" />
                <rect x="13" y="13" width="9" height="9" />
              </svg>
              {t("accounts.add")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AccountSwitcher;
