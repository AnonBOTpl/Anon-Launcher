import type { DeviceCodeResponse } from "@/types/auth";
import { open } from "@tauri-apps/plugin-shell";

interface DeviceCodeDisplayProps {
  deviceCode: DeviceCodeResponse;
  onCancel: () => void;
}

function DeviceCodeDisplay({ deviceCode, onCancel }: DeviceCodeDisplayProps) {
  const openVerificationUrl = () => {
    open(deviceCode.verificationUri);
  };

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      {/* Instructions */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Otwórz poniższą stronę w przeglądarce i wpisz kod:
        </p>
      </div>

      {/* Verification URL */}
      <button
        onClick={openVerificationUrl}
        className="inline-flex items-center gap-2 rounded-xl bg-purple-500/10 px-5 py-2.5 text-sm font-medium text-purple-400 hover:bg-purple-500/20 transition-colors"
      >
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
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
        {deviceCode.verificationUri}
      </button>

      {/* Device code — large */}
      <div className="my-2">
        <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 px-10 py-4">
          <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-2">
            Kod
          </p>
          <p className="text-center text-3xl font-bold tracking-[0.3em] text-purple-400 select-all">
            {deviceCode.userCode}
          </p>
        </div>
      </div>

      {/* Message from Microsoft */}
      <p className="max-w-sm text-center text-xs text-muted-foreground">
        {deviceCode.message}
      </p>

      {/* Cancel button */}
      <button
        onClick={onCancel}
        className="mt-2 inline-flex h-9 items-center gap-2 rounded-xl border bg-card/60 px-4 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        Anuluj logowanie
      </button>
    </div>
  );
}

export default DeviceCodeDisplay;
