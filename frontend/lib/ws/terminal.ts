import { toast } from "sonner";
import { WebSocketClient } from ".";
import { $ } from "../i18n";

export type ConsoleLogLevel = "INFO" | "WARN" | "ERROR";

export function getLogLevels(info = true, warn = true, error = true): ConsoleLogLevel[] {
  const levels: ConsoleLogLevel[] = [];
  if(info) levels.push("INFO");
  if(warn) levels.push("WARN");
  if(error) levels.push("ERROR");

  return levels;
}

export interface ConsoleLog {
  time: number
  level: ConsoleLogLevel
  thread: string
  source: string
  line: string
  thrownMessage: string | null
  mcdr: boolean
  uuid?: string
}

export type TerminalMessageType = (
  /* server packet */
  "init"
  | "log"
  | "mcdr-log"
  /* client packet */
  | "command"
  /* common packet */
  | "autocomplete"
);

export class TerminalClient extends WebSocketClient<TerminalMessageType> {
  constructor() {
    super("/socket/terminal");
  }

  protected override onOpen() {
    console.log("Terminal connected.");
  }
  
  protected override onClose() {
    console.log("Terminal disconnected.");
  }

  protected override onError(err: Event) {
    console.log("Terminal connection failed. ", err);
    toast.error($("terminal.ws.error"));
  }
}
