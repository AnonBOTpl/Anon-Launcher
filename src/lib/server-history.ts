const STORAGE_KEY = "anon_server_history";
const MAX_HISTORY = 10;

export interface ServerEntry {
  address: string;
  port?: number;
  lastJoined: number;
  instanceName: string;
}

function getAllHistory(): Record<string, ServerEntry[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/** Get server history for a specific instance */
export function getServerHistory(instanceName: string): ServerEntry[] {
  return getAllHistory()[instanceName] ?? [];
}

/** Add or update a server entry (dedup by address, newest first) */
export function addServerEntry(
  instanceName: string,
  address: string,
  port?: number,
): void {
  const history = getAllHistory();
  const entries = history[instanceName] ?? [];

  // Remove duplicate if exists
  const cleaned = entries.filter((e) => e.address !== address);

  // Add to front
  cleaned.unshift({
    address,
    port,
    lastJoined: Date.now(),
    instanceName,
  });

  // Trim to max
  history[instanceName] = cleaned.slice(0, MAX_HISTORY);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

/** Remove a specific server entry from history */
export function removeServerEntry(
  instanceName: string,
  address: string,
): void {
  const history = getAllHistory();
  if (!history[instanceName]) return;
  history[instanceName] = history[instanceName].filter(
    (e) => e.address !== address,
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

/** Clear all history for an instance */
export function clearServerHistory(instanceName: string): void {
  const history = getAllHistory();
  delete history[instanceName];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

/** Parse an address string into ip + optional port */
export function parseServerAddress(input: string): {
  ip: string;
  port?: number;
} {
  const trimmed = input.trim();
  const colonIndex = trimmed.lastIndexOf(":");
  if (colonIndex > 0) {
    const potentialPort = trimmed.slice(colonIndex + 1);
    const port = parseInt(potentialPort, 10);
    if (!isNaN(port) && port > 0 && port <= 65535) {
      return { ip: trimmed.slice(0, colonIndex), port };
    }
  }
  return { ip: trimmed };
}
