export function LayerToggle({ checked }: { checked: boolean }) {
  return (
    <span className={`chipToggle ${checked ? "chipToggleOn" : ""}`} aria-hidden="true">
      <span className="chipToggleThumb" />
    </span>
  );
}
