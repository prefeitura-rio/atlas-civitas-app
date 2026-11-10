import Swal, { type SweetAlertOptions } from "sweetalert2";

function icon(paths: string) {
  return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

const icons = {
  info: icon('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  warning: icon('<path d="M12 3 2 21h20L12 3ZM12 9v4M12 17h.01"/>'),
  success: icon('<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'),
  error: icon('<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>'),
  question: icon('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 17h.01"/>'),
};
const streamingIcon = icon('<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3M2 2l20 20"/>');

const themedAlert = Swal.mixin({
  buttonsStyling: false,
  heightAuto: false,
  showCloseButton: false,
  confirmButtonText: "Entendi",
  customClass: {
    popup: "atlasSwalPopup atlasAppAlertPopup",
    title: "atlasSwalTitle",
    htmlContainer: "atlasSwalHtml",
    footer: "atlasSwalFooter",
    icon: "atlasAppAlertIcon",
    confirmButton: "atlasSwalBtn atlasSwalBtnPrimary",
    cancelButton: "atlasSwalBtn atlasSwalBtnGhost",
  },
});

export function showAppAlert(options: SweetAlertOptions) {
  return themedAlert.fire({
    ...options,
    iconHtml: options.iconHtml ?? icons[options.icon ?? "info"],
  });
}

export function showStreamingAlert(options: SweetAlertOptions) {
  return showAppAlert({ ...options, iconHtml: streamingIcon });
}
