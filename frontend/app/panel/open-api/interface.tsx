import type { PropsWithChildren } from "react";
import type { LucideIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { googleSansCode } from "@/lib/fonts";
import { TextCopy } from "@/components/text-copy";
import { cn } from "@/lib/utils";
import { monacoSettingsOptions } from "@/lib/settings";
import { $ } from "@/lib/i18n";
import { ConfigItem, ConfigSection } from "@/components/config-item";
import { Switch } from "@/components/ui/switch";
import { sendGetRequest, sendPostRequest, toastError } from "@/lib/api";

const MonacoEditor = dynamic(() => import("@/components/monaco-editor"), { ssr: false });

export type OpenAPIInterfaceName = "info" | "monitor" | "plugins" | "players";

export function InterfaceSection({
  interfaceName,
  icon,
  children
}: PropsWithChildren & {
  interfaceName: OpenAPIInterfaceName
  icon: LucideIcon
}) {
  const [enabled, setEnabled] = useState(false);

  const fetchInterfaceEnabled = useCallback(async () => {
    try {
      const { enabled: interfaceEnabled } = await sendGetRequest<{ enabled: boolean }>(`/api/open-api/${interfaceName}`);
      setEnabled(interfaceEnabled);
    } catch (e: any) {
      toastError(e, `${$("open-api.fetch.error")} (${interfaceName})`, [
        [400, $("common.error.400")],
        [401, $("common.error.401")],
        [500, $("common.error.500")]
      ]);
    }
  }, [interfaceName]);

  const handleToggleInterface = async (enabled: boolean) => {
    try {
      await sendPostRequest(`/api/open-api/${interfaceName}?enabled=${enabled ? "1" : "0"}`);
      setEnabled(enabled);
    } catch (e: any) {
      toastError(e, `${enabled ? $("open-api.toggle.enable.error") : $("open-api.toggle.disable.error")} (${interfaceName})`, [
        [400, $("common.error.400")],
        [401, $("common.error.401")],
        [500, $("common.error.500")]
      ]);
    }
  };

  useEffect(() => {
    fetchInterfaceEnabled();
  }, [fetchInterfaceEnabled]);

  return (
    <ConfigSection>
      <ConfigItem
        icon={icon}
        name={$("open-api.interfaces."+ interfaceName as any)}>
        <Switch
          checked={enabled}
          onCheckedChange={(enabled) => handleToggleInterface(enabled)}/>
      </ConfigItem>
      {children}
    </ConfigSection>
  );
}

export function Interface({
  method,
  route,
  children
}: PropsWithChildren & {
  method: "GET" | "POST" | "PATCH" | "DELETE"
  route: string
}) {
  return (
    <div
      data-slot="interface"
      className="p-3 border-b last:border-b-0 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={cn(
          "px-1 text-sm",
          method === "GET" && "text-emerald-500",
          method === "POST" && "text-blue-500 dark:text-blue-400",
          method === "PATCH" && "text-yellow-700 dark:text-yellow-600",
          method === "DELETE" && "text-destructive",
          googleSansCode.className
        )}>
          {method}
        </span>
        <TextCopy
          text={route}
          className="flex-1"/>
      </div>
      {children}
    </div>
  );
}

export function InterfaceDescription({ children }: PropsWithChildren) {
  return (
    <span className="text-sm text-muted-foreground">{children}</span>
  );
}

export function InterfaceRequest({
  def
}: {
  def: string
}) {
  const { theme } = useTheme();

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{$("open-api.interfaces.request")}</span>
      <MonacoEditor
        defaultLanguage="typescript"
        value={def}
        theme={theme === "dark" ? "opanel-theme-dark-default" : "opanel-theme"}
        options={{
          minimap: { enabled: false },
          lineNumbers: "off",
          automaticLayout: true,
          tabSize: 2,
          readOnly: true,
          contextmenu: false,
          showUnused: false,
          showDeprecated: false,
          scrollbar: {
            vertical: "hidden",
            handleMouseWheel: false
          },
          ...monacoSettingsOptions
        }}
        autoFitHeight
        className="border rounded-md overflow-hidden"/>
    </div>
  );
}

export function InterfaceResponse({
  def
}: {
  def: string
}) {
  const { theme } = useTheme();

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{$("open-api.interfaces.response")}</span>
      <MonacoEditor
        defaultLanguage="typescript"
        value={def}
        theme={theme === "dark" ? "opanel-theme-dark-default" : "opanel-theme"}
        options={{
          minimap: { enabled: false },
          lineNumbers: "off",
          automaticLayout: true,
          tabSize: 2,
          readOnly: true,
          contextmenu: false,
          showUnused: false,
          showDeprecated: false,
          scrollbar: {
            vertical: "hidden",
            handleMouseWheel: false
          },
          ...monacoSettingsOptions
        }}
        autoFitHeight
        className="border rounded-md overflow-hidden"/>
    </div>
  );
}

