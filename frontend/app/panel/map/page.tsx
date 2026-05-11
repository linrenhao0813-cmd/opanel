"use client";

import dynamic from "next/dynamic";
import { SubPage } from "../sub-page";

const MapCanvas = dynamic(() => import("./map-canvas").then((m) => m.MapCanvas), {
  ssr: false,
});

export default function ServerMap() {
  return (
    <SubPage
      title="地图"
      showHeader={false}
      className="bg-background p-0">
      <div className="w-full h-full bg-white shadow-[inset_0px_0px_20px_4px_rgba(0,0,0,0.28)]">
        <MapCanvas />
      </div>
    </SubPage>
  );
}
