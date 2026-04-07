import { toastRestartAlert } from "@/components/restart-alert";
import { apiUrl, sendDeleteRequest, sendPostRequest, toastError } from "@/lib/api";
import { emitter } from "@/lib/emitter";
import { $ } from "@/lib/i18n";

export async function downloadPlugin(fileName: string) {
  window.open(`${apiUrl}/api/plugins/${fileName}`, "_blank");
}

export async function togglePlugin(fileName: string, enabled: boolean) {
  try {
    await sendPostRequest(`/api/plugins/${fileName}?enabled=${enabled ? "1" : "0"}`);
    emitter.emit("refresh-data");
    toastRestartAlert();
  } catch (e: any) {
    toastError(e, enabled ? $("plugins.action.toggle.enable.error", fileName) : $("plugins.action.toggle.disable.error", fileName), [
      [400, $("common.error.400")],
      [401, $("common.error.401")],
      [403, $("plugins.action.toggle.disable.error.403")],
      [404, $("plugins.action.toggle.error.404", fileName)],
      [500, $("common.error.500")]
    ]);
  }
}

export async function deletePlugin(fileName: string) {
  try {
    const { code } = await sendDeleteRequest(`/api/plugins/${fileName}`);
    emitter.emit("refresh-data");
    if(code === 202) { // 202 Accepted
      toastRestartAlert();
    }
  } catch (e: any) {
    toastError(e, $("plugins.action.delete.error"), [
      [400, $("common.error.400")],
      [401, $("common.error.401")],
      [403, $("plugins.action.delete.error.403")],
      [404, $("plugins.action.delete.error.404", fileName)],
      [500, $("common.error.500")]
    ]);
  }
}
