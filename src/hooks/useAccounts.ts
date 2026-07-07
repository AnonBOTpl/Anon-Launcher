import { useState, useEffect, useCallback } from "react";
import type { AccountMeta, AccountDisplay } from "@/types/account";
import * as accountsApi from "@/lib/accounts";
import { clearAccountSession } from "@/lib/accounts";

export function useAccounts() {
  const [accounts, setAccounts] = useState<AccountDisplay[]>([]);
  const [activeAccount, setActiveAccount] = useState<AccountMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const [list, active] = await Promise.all([
        accountsApi.listAccounts(),
        accountsApi.getActiveAccount(),
      ]);
      setActiveAccount(active);
      setAccounts(
        list.map((a) => ({
          uuid: a.uuid,
          username: a.username,
          lastUsed: a.last_used,
          isActive: active?.uuid === a.uuid,
        })),
      );
    } catch (err) {
      console.error("Failed to load accounts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const switchAccount = useCallback(
    async (uuid: string) => {
      await accountsApi.setActiveAccount(uuid);
      await refresh();
    },
    [refresh],
  );

  const removeAccount = useCallback(
    async (uuid: string) => {
      // Jeśli usuwamy aktywne konto, wyczyść sesję z localStorage
      if (activeAccount?.uuid === uuid) {
        clearAccountSession();
      }
      await accountsApi.deleteAccount(uuid);
      await refresh();
    },
    [activeAccount, refresh],
  );

  return {
    accounts,
    activeAccount,
    loading,
    refresh,
    switchAccount,
    removeAccount,
  };
}
