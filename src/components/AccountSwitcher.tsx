import { useState, useEffect } from "react";
import { useAccounts } from "@/hooks/useAccounts";
import { useAuth } from "@/hooks/useAuth";
import * as accountsApi from "@/lib/accounts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function AccountSwitcher() {
  const { accounts, activeAccount, switchAccount, loading, removeAccount, refresh } = useAccounts();
  const { startLogin, flowState, session } = useAuth();
  const [open, setOpen] = useState(false);

  const initials = activeAccount?.username?.charAt(0).toUpperCase() ?? "?";
  const isOffline = activeAccount?.offline ?? false;

  const handleSwitch = async (uuid: string) => {
    await switchAccount(uuid);
    setOpen(false);
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
      <button
        onClick={() => setOpen(true)}
        title={activeAccount ? activeAccount.username : "Konto"}
        className="group relative flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-accent cursor-pointer"
      >
        <span className="text-xs font-bold">{initials}</span>
        {/* Online/Offline dot */}
        <span
          className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar-background ${
            isOffline
              ? "bg-amber-500"
              : activeAccount
                ? "bg-emerald-500"
                : "bg-muted-foreground/30"
          }`}
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Zarządzanie kontami</DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-purple-500" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Brak zapisanych kont
              </div>
            ) : (
              accounts.map((account) => (
                <button
                  key={account.uuid}
                  onClick={() => handleSwitch(account.uuid)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    account.isActive
                      ? "bg-purple-500/15 text-purple-300"
                      : "text-foreground hover:bg-accent"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      account.isActive
                        ? "bg-purple-500/20 text-purple-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {account.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="truncate font-medium">
                      {account.username}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {account.offline ? "Tryb offline" : "Konto Microsoft"}
                    </div>
                  </div>
                  {account.isActive && (
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
                      className="text-purple-400 shrink-0"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>

          <div className="flex flex-col gap-2 pt-2">
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
              Dodaj konto
            </Button>

            {activeAccount && (
              <Button
                onClick={handleLogout}
                variant="ghost"
                className="w-full text-muted-foreground hover:text-destructive"
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
                  className="mr-2"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Wyloguj aktywne konto
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AccountSwitcher;
