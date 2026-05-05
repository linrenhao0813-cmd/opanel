"use client";

import type { APIResponse, InfoResponse, MonitorResponse } from "@/lib/types";
import { useContext, useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import { InfoContext, MonitorContext, VersionContext } from "@/contexts/api-context";
import { sendGetRequest, toastError } from "@/lib/api";
import { cn, getCurrentState } from "@/lib/utils";
import { InfoCard } from "./info-card";
import { TimeCard } from "./time-card";
import { PlayersCard } from "./players-card";
import { MonitorCard } from "./monitor-card";
import { TerminalCard } from "./terminal-card";
import { TPSCard } from "./tps-card";
import { SubPage } from "../sub-page";
import { emitter } from "@/lib/emitter";
import { getSettings } from "@/lib/settings";
import { $ } from "@/lib/i18n";
import { SystemCard } from "./system-card";
import { Skeleton } from "@/components/ui/skeleton";

const requestMonitorInterval = getSettings("dashboard.monitor-interval");

function CardSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton className={cn("rounded-sm bg-background", className)}/>
  );
}

export default function Dashboard() {
  const versionCtx = useContext(VersionContext);
  const [info, setInfo] = useState<APIResponse<InfoResponse>>();
  const [monitorData, setMonitorData] = useState(
    new Array<MonitorResponse>(50).fill({ cpu: 0, memory: 0, tps: 20 })
  );

  const fetchServerInfo = async () => {
    try {
      const res = await sendGetRequest<InfoResponse>("/api/info");
      setInfo(res);
    } catch (e: any) {
      toastError(e, $("dashboard.error"), [
        [401, $("common.error.401")],
        [500, $("common.error.500")]
      ]);
    }
  };

  const requestMonitor = async () => {
    const res = await sendGetRequest<MonitorResponse>("/api/monitor");
    const currentData = await getCurrentState(setMonitorData);
    const newData = [...currentData];
    newData.shift();
    newData.push(res);
    setMonitorData(newData);
  };

  useEffect(() => {
    fetchServerInfo();

    emitter.on("refresh-data", () => fetchServerInfo());
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      requestMonitor();
    }, requestMonitorInterval);

    return () => clearInterval(timer);
  }, []);

  return (
    <SubPage
      title={$("dashboard.title")}
      category={$("sidebar.server")}
      icon={<Gauge />}
      pageClassName="min-2xl:px-[5%]"
      className="flex-1 min-h-0 min-xl:h-full max-xl-h:min-h-[600px] flex max-xl:flex-col gap-2">
      <InfoContext.Provider value={info}>
        <MonitorContext.Provider value={monitorData}>
          {/* Left side */}
          <div className="flex-2 flex flex-col gap-2">
            {/* Upper */}
            {
              info && versionCtx
              ? <InfoCard className="row-start-1 col-span-2"/>
              : <CardSkeleton className="row-start-1 col-span-2 min-lg:min-h-36 min-lg:max-h-36"/>
            }

            {/* Center */}
            <div className="flex-1 min-h-0 flex max-lg:flex-col gap-2 *:flex-1">
              {
                info
                ? <PlayersCard className="row-span-3"/>
                : <CardSkeleton className="row-span-3"/>
              }
              {
                info
                ? <MonitorCard className="row-span-3"/>
                : <CardSkeleton className="row-span-3"/>
              }
            </div>

            {/* Lower */}
            <div className="min-lg:h-36 flex max-lg:flex-col gap-2 *:flex-1">
              {
                info
                ? <TimeCard />
                : <CardSkeleton />
              }
              {
                info
                ? <TPSCard />
                : <CardSkeleton />
              }
            </div>
          </div>

          {/* Right side */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2 min-xl:overflow-hidden">
            {
              info
              ? <SystemCard />
              : <CardSkeleton className="h-72"/>
            }
            {
              info
              ? <TerminalCard className="flex-1 min-h-0 max-xl:min-h-128"/>
              : <CardSkeleton className="flex-1 min-h-0 max-xl:min-h-128"/>
            }
          </div>
        </MonitorContext.Provider>
      </InfoContext.Provider>
    </SubPage>
  );
}
