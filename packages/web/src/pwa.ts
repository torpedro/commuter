export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) {
    return;
  }

  window.addEventListener("load", () => {
    const serviceWorkerUrl = new URL("./sw.js", document.baseURI);
    navigator.serviceWorker.register(serviceWorkerUrl);
  });
}
