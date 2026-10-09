/** No data or secrets travel between tabs: each one reloads its authorized view. */
export function notifyWorkspaceChange() {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
  const channel = new BroadcastChannel("studioflow-workspace-update");
  channel.postMessage("refresh");
  channel.close();
}
