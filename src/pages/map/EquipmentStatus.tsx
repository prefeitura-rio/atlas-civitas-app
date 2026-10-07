export function EquipmentStatus({ active }: { active: boolean }) {
  return (
    <span className={`equipmentStatus ${active ? "equipmentStatusActive" : "equipmentStatusInactive"}`}>
      <span className="equipmentStatusDot" aria-hidden="true" />
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}
