import { useTranslation } from "react-i18next";
import CreateInstanceForm from "@/components/CreateInstanceForm";

function CreateInstance() {
  const { t } = useTranslation();
  return (
    <div className="min-h-full animate-page-enter">
      <div className="border-b border-border/50 px-8 py-4">
        <h1 className="text-xl font-bold tracking-tight">{t("create.title")}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t("create.subtitle")}
        </p>
      </div>

      <div className="p-8 pt-6">
        <CreateInstanceForm />
      </div>
    </div>
  );
}

export default CreateInstance;
