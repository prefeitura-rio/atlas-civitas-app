import cameraIcon from "@/assets/camera-icon.png";
import cameraIntelIcon from "@/assets/cameras-inteligentes-icon.png";
import cameraLprIcon from "@/assets/camera-lpr-icon-satellite.png";
import radarIcon from "@/assets/radar-icon-satellite.png";

export type ClusterCounts = {
  camera: number;
  camera_intel: number;
  camera_lpr: number;
  radar: number;
};

const equipmentTypes = [
  { kind: "camera", label: "Câmeras", icon: cameraIcon },
  { kind: "camera_intel", label: "Super Câmeras Inteligentes", icon: cameraIntelIcon },
  { kind: "camera_lpr", label: "LPR", icon: cameraLprIcon },
  { kind: "radar", label: "Radares", icon: radarIcon },
] as const;

export function ClusterSummary({ counts }: { counts: ClusterCounts }) {
  const items = equipmentTypes.filter(({ kind }) => counts[kind] > 0);
  const total = items.reduce((sum, { kind }) => sum + counts[kind], 0);

  if (!total) return null;

  return (
    <aside className="mapClusterSummary" aria-label="Equipamentos no agrupamento">
      <div className="mapClusterSummaryHeader">
        <span>Neste agrupamento</span>
        <strong>{total.toLocaleString("pt-BR")}</strong>
      </div>
      <dl className="mapClusterSummaryItems">
        {items.map(({ kind, label, icon }) => (
          <div className="mapClusterSummaryItem" key={kind}>
            <dt><img src={icon} alt="" />{label}</dt>
            <dd>{counts[kind].toLocaleString("pt-BR")}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
