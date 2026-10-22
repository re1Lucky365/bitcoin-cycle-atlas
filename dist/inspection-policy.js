/** A chart selection owns the value/date, never the surrounding panel layout. */
export function chartSelectionHandler(inspect) {
  return (detail, options = {}) => inspect(detail, { ...options, openPanel: false });
}

/** Explicit detail controls open; ordinary selections only refresh an open reader. */
export function inspectionPanelAction(detail, { open = false, kind = null } = {}) {
  if (detail?.openPanel === true) return 'open';
  return open && kind === 'selection' ? 'refresh' : 'preserve';
}
