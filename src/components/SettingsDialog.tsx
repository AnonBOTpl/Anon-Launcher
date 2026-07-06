import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface SettingsDialogProps {
  children?: React.ReactNode;
}

function SettingsDialog({ children }: SettingsDialogProps) {
  return (
    <Dialog>
      {children && <DialogTrigger>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ustawienia</DialogTitle>
          <DialogDescription>
            AnonLauncher jest gotowy do użycia z kontem Microsoft.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2 text-sm text-muted-foreground">
          <p>
            Logowanie Microsoft jest fabrycznie skonfigurowane z Client ID
            zatwierdzonym przez Microsoft dla Minecraft.
          </p>
          <p>
            Kliknij przycisk <strong>Zaloguj przez Microsoft</strong> w sidebarze,
            aby zalogować się na swoje konto i rozpocząć grę.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsDialog;
