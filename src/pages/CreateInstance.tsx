import CreateInstanceForm from "@/components/CreateInstanceForm";

function CreateInstance() {
  return (
    <div className="min-h-full">
      <div className="border-b border-border/50 px-8 py-4">
        <h1 className="text-xl font-bold tracking-tight">Nowa instancja</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Skonfiguruj i utwórz nową instancję Minecraft
        </p>
      </div>

      <div className="p-8 pt-6">
        <CreateInstanceForm />
      </div>
    </div>
  );
}

export default CreateInstance;
