import { useEffect, useState } from "react";
import { FiAlertTriangle, FiX } from "react-icons/fi";
import { reportCategories } from "@/utils/report";
import "./ReportModal.css";

function ReportModal({
  open,
  targetLabel = "konten",
  isSubmitting = false,
  errorMessage = "",
  onClose,
  onSubmit,
}) {
  const [category, setCategory] = useState(reportCategories[0].value);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setCategory(reportCategories[0].value);
      setReason("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit?.({
      category,
      reason: reason.trim(),
    });
  };

  return (
    <div className="report-modal" role="presentation" onClick={onClose}>
      <form
        className="report-modal__dialog"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header className="report-modal__header">
          <span>
            <FiAlertTriangle />
          </span>
          <div>
            <h2>Laporkan {targetLabel}</h2>
            <p>Pilih kategori dan jelaskan masalahnya secara singkat.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup report">
            <FiX />
          </button>
        </header>

        <label className="report-modal__field">
          <span>Kategori report</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {reportCategories.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="report-modal__field">
          <span>Alasan report</span>
          <textarea
            value={reason}
            maxLength={500}
            placeholder="Contoh: Konten ini mengandung spoiler tanpa peringatan."
            onChange={(event) => setReason(event.target.value)}
          />
        </label>

        <div className="report-modal__footer">
          <small>{reason.trim().length}/500 karakter</small>
          {errorMessage && <p role="alert">{errorMessage}</p>}
          <button
            type="submit"
            disabled={isSubmitting || reason.trim().length < 8}
          >
            {isSubmitting ? "Mengirim..." : "Kirim Report"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ReportModal;
