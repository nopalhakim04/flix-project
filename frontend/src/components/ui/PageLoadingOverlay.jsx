import "./PageLoadingOverlay.css";

function PageLoadingOverlay({ visible }) {
  return (
    <div className={`page-loading${visible ? " is-visible" : ""}`} aria-hidden={!visible}>
      <div className="page-loading__panel" role="status" aria-live="polite">
        <div className="page-loading__logo">
          FL<span>I</span>X
        </div>
        <div className="page-loading__spinner" aria-hidden="true" />
        <p>Memuat halaman...</p>
        <div className="page-loading__bar" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}

export default PageLoadingOverlay;
