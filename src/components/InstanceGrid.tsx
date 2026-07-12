import type { InstanceManifest } from "@/types/instance";
import InstanceCard from "./InstanceCard";

interface InstanceGridProps {
  instances: InstanceManifest[];
  onInstanceDeleted?: () => void;
}

function InstanceGrid({ instances, onInstanceDeleted }: InstanceGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {instances.map((instance, index) => (
        <div
          key={instance.name}
          className="animate-stagger-in"
          style={{ "--stagger-delay": index * 80 } as React.CSSProperties}
        >
          <InstanceCard
            instance={instance}
            onDeleted={onInstanceDeleted}
          />
        </div>
      ))}
    </div>
  );
}

export default InstanceGrid;
