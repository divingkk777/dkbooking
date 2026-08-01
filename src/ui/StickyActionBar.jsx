export default function StickyActionBar({
  leftLabel,
  onLeft,
  rightLabel,
  onRight,
  rightDisabled = false,
  hideLeft = false,
}) {
  return (
    <div className="sticky-action-bar">
      <div className="sticky-action-bar-inner">
        {!hideLeft && (
          <button type="button" className="btn-secondary" onClick={onLeft}>
            {leftLabel}
          </button>
        )}
        <button
          type="button"
          className="btn-primary"
          onClick={onRight}
          disabled={rightDisabled}
        >
          {rightLabel}
        </button>
      </div>
    </div>
  );
}
