import type { ArrayItem, GithubReleaseResponse } from "@/lib/types";
import Link from "next/link";
import { type PropsWithChildren, useEffect, useState } from "react";
import * as MarkdownJSX from "markdown-to-jsx";
import { RotateCw, SquareArrowOutUpRight } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { Spinner } from "@/components/ui/spinner";
import { version } from "@/lib/global";
import { googleSansCode } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toastError } from "@/lib/api";
import { changeSettings, getSettings } from "@/lib/settings";
import { $ } from "@/lib/i18n";
import { checkUpdate } from "@/lib/update";

function preprocessMarkdown(markdown: string): string {
  // Github username
  markdown = markdown.replace(/@([\w-_]+)/g, (match, username) => `**[${match}](https://github.com/${username})**`);
  // Issue reference
  markdown = markdown.replace(/#(\d+)/g, (match, issueId) => `[${match}](https://github.com/opanel-mc/opanel/issues/${issueId})`);

  return markdown;
}

export function UpdateDialog({
  children,
  asChild
}: PropsWithChildren & {
  asChild?: boolean
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasNewUpdate, setHasNewUpdate] = useState<boolean | null>(null);
  const [releaseInfo, setReleaseInfo] = useState<ArrayItem<GithubReleaseResponse> | null>(null);
  const [previewEnabled, setPreviewEnabled] = useState(getSettings("system.preview-channel"));

  const fetchUpdateInfo = async () => {
    setLoading(true);
    try {
      const { hasNewUpdate, releaseInfo } = await checkUpdate();
      setHasNewUpdate(hasNewUpdate);
      setReleaseInfo(releaseInfo);
      setLoading(false);
    } catch (e: any) {
      toastError(e, $("settings.update.error"), [
        [403, $("settings.update.error.403")],
        [500, $("settings.update.error.500")]
      ]);
      setLoading(false);
      setError(true);
    }
  };

  useEffect(() => {
    changeSettings("system.preview-channel", previewEnabled);
  }, [previewEnabled]);

  return (
    <Dialog onOpenChange={(open) => (open && hasNewUpdate === null) && fetchUpdateInfo()}>
      <DialogTrigger asChild={asChild}>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{$("settings.update.title")}</DialogTitle>
          <DialogDescription>
            {$("settings.update.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-6">
          <div className="min-h-18 px-4 border rounded-md flex items-center gap-4">
            <Logo size={26}/>
            <div className="py-2 flex flex-col justify-between">
              <span className="font-semibold whitespace-nowrap">
                {
                  loading
                  ? $("settings.update.status.checking")
                  : (
                    error
                    ? $("settings.update.error")
                    : (
                      hasNewUpdate
                      ? $("settings.update.status.has-new-update")
                      : $("settings.update.status.latest")
                    )
                  )
                }
              </span>
              <span className="text-sm text-muted-foreground">OPanel {version + (hasNewUpdate ? ` → ${releaseInfo?.tag_name}` : "")}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto cursor-pointer"
              disabled={loading}
              onClick={() => fetchUpdateInfo()}>
              {loading ? <Spinner /> : <RotateCw />}
            </Button>
          </div>
          {(hasNewUpdate && releaseInfo) && (
            <div className="max-h-64 px-3 space-y-3 overflow-y-auto o-scrollbar">
              <h2 className="font-semibold text-xl">{$("settings.update.release-note.title", releaseInfo.tag_name)}</h2>
              <MarkdownJSX.default
                options={{
                  wrapper: "article",
                  forceWrapper: true
                }}
                className={cn("text-sm *:wrap-anywhere", googleSansCode.className)}>
                {preprocessMarkdown(releaseInfo.body)}
              </MarkdownJSX.default>
            </div>
          )}
        </div>
        <DialogFooter className="flex-row! justify-between! items-center">
          <div className="flex items-center gap-2">
            <Switch
              checked={previewEnabled}
              onCheckedChange={setPreviewEnabled}/>
            <Label>{$("settings.update.preview-channel")}</Label>
          </div>

          <div className="space-x-2">
            {hasNewUpdate && (
              <Button className="ml-auto" asChild>
                <Link href="https://dist.opanel.cn" target="_blank" rel="noopener noreferrer">
                  下载更新
                  <SquareArrowOutUpRight className="!size-3"/>
                </Link>
              </Button>
            )}
            <DialogClose asChild>
              <Button variant="outline">
                {$("dialog.close")}
              </Button>
            </DialogClose>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
