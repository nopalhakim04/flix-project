import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import "./alerts.css";

const baseCustomClass = {
  popup: "flix-swal-popup",
  title: "flix-swal-title",
  htmlContainer: "flix-swal-html",
  confirmButton: "flix-swal-confirm",
  cancelButton: "flix-swal-cancel",
};

export const showAlert = ({
  title = "FLIX",
  text = "",
  icon = "info",
  confirmButtonText = "Mengerti",
  ...options
} = {}) =>
  Swal.fire({
    title,
    text,
    icon,
    background: "#111111",
    color: "#ffffff",
    confirmButtonText,
    buttonsStyling: false,
    customClass: baseCustomClass,
    ...options,
  });

export const showToast = ({
  title,
  icon = "success",
  timer = 2200,
  position = "top-end",
  ...options
} = {}) =>
  Swal.fire({
    toast: true,
    title,
    icon,
    timer,
    position,
    showConfirmButton: false,
    timerProgressBar: true,
    background: "#111111",
    color: "#ffffff",
    customClass: {
      popup: "flix-swal-toast",
      title: "flix-swal-toast-title",
    },
    ...options,
  });

export const confirmAction = async ({
  title = "Konfirmasi",
  text = "",
  icon = "warning",
  confirmButtonText = "Ya, lanjutkan",
  cancelButtonText = "Batal",
  ...options
} = {}) => {
  const result = await Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    reverseButtons: true,
    background: "#111111",
    color: "#ffffff",
    confirmButtonText,
    cancelButtonText,
    buttonsStyling: false,
    customClass: baseCustomClass,
    ...options,
  });

  return result.isConfirmed;
};

export const promptInput = async ({
  title = "Masukkan data",
  text = "",
  inputValue = "",
  inputPlaceholder = "",
  confirmButtonText = "Simpan",
  cancelButtonText = "Batal",
  ...options
} = {}) => {
  const result = await Swal.fire({
    title,
    text,
    input: "text",
    inputValue,
    inputPlaceholder,
    showCancelButton: true,
    reverseButtons: true,
    background: "#111111",
    color: "#ffffff",
    confirmButtonText,
    cancelButtonText,
    buttonsStyling: false,
    customClass: {
      ...baseCustomClass,
      input: "flix-swal-input",
    },
    ...options,
  });

  return result.isConfirmed ? result.value : null;
};
