import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAccounts } from "@/hooks/useAccounts";
import * as accountsApi from "@/lib/accounts";
import { saveAccountSession, setActiveAccount } from "@/lib/accounts";
import DeviceCodeDisplay from "@/components/DeviceCodeDisplay";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AccountManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AccountManagerDialog({
  open,
  onOpenChange,
}: AccountManagerDialogProps) {
  const {
    session,
    startLogin,
    cancelLogin,
    flowState,
  } = useAuth();
  const { accounts, refresh, removeAccount } = useAccounts();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Refresh the list when dialog opens
  useEffect(() => {
    if (open) {
      refresh();
    }
  }, [open, refresh]);

  // When a new session is obtained from auth flow, save it as an account
  useEffect(() => {
    if (flowState.step === "done" && session) {
      // Najpierw zapisz konto, potem ustaw jako aktywne (zapobiega race condition z backendem)
      Promise.allSettled([
        accountsApi.saveAccount(session),
        saveAccountSession(session),
      ]).then(async () => {
        await setActiveAccount(session.uuid).catch((err) =>
          console.warn("Failed to set active account:", err)
        );
        refresh();
      });
    }
  }, [flowState.step, session, refresh]);

  // Show the auth flow state when logging in
  const isLoggingIn =
    flowState.step === "code" ||
    flowState.step === "polling" ||
    flowState.step === "completing";

  const handleDelete = async (uuid: string) => {
    await removeAccount(uuid);
    setConfirmDelete(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Zarządzaj kontami</DialogTitle>
          <DialogDescription>
            Dodaj lub usuń konta Microsoft. Aktywne konto jest używane do gry.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Auth error */}
          {flowState.step === "error" && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
              {flowState.error || "Wystąpił błąd podczas logowania"}
            </div>
          )}

          {/* Logging in state */}
          {isLoggingIn && (
            <div className="flex flex-col items-center gap-3 py-4">
              {flowState.deviceCode && (
                <DeviceCodeDisplay
                  deviceCode={flowState.deviceCode}
                  onCancel={cancelLogin}
                />
              )}
              {!flowState.deviceCode && (
                <>
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-muted border-t-purple-500" />
                  <p className="text-xs text-muted-foreground">
                    {flowState.step === "completing"
                      ? "Pobieranie profilu Minecraft..."
                      : "Oczekiwanie na autoryzację..."}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={cancelLogin}
                    className="text-xs"
                  >
                    Anuluj
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Account list */}
          {!isLoggingIn && (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {accounts.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Brak zapisanych kont. Kliknij "Dodaj konto", aby się zalogować.
                </div>
              ) : (
                accounts.map((account) => (
                  <div
                    key={account.uuid}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                      account.isActive
                        ? "border-purple-500/30 bg-purple-500/5"
                        : "border-border/50 bg-card"
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                        account.isActive
                          ? "bg-purple-500/20 text-purple-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {account.username.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {account.username}
                        </span>
                        {account.isActive && (
                          <span className="shrink-0 rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-medium text-purple-400">
                            AKTYWNE
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {account.offline
                          ? "Tryb offline (dev)"
                          : "Konto Microsoft"}
                      </div>
                    </div>

                    {/* Delete */}
                    {confirmDelete === account.uuid ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(account.uuid)}
                          className="h-7 text-xs px-2"
                        >
                          Usuń
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDelete(null)}
                          className="h-7 text-xs px-2"
                        >
                          Anuluj
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(account.uuid)}
                        title="Usuń konto"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
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
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Add account button */}
          {!isLoggingIn && (
            <Button
              onClick={startLogin}
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
              Dodaj konto Microsoft
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AccountManagerDialog;
