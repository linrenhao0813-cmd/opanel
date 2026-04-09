import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-format-parse";
import AnsiConverter from "ansi-to-html";
import { cn, getCurrentState, purifyUnsafeText } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { googleSansCode } from "@/lib/fonts";
import {
  type ConsoleLog,
  type TerminalClient,
  defaultLogLevel,
  getLogLevelId,
  type ConsoleLogLevel
} from "@/lib/ws/terminal";
import { parseTextToANSI, secSign } from "@/lib/formatting-codes/text";

const MAX_LOG_LINES = getSettings("terminal.max-log-lines");
const STOP_SCROLLING_TIME = 5000;

/** @see https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url */
const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,4}\b([-a-zA-Z0-9@:;%_\+.~#?&//=]*)/g;

function preprocessLogLine(line: string): string {
  if(getSettings("terminal.rich-style")) {
    line = new AnsiConverter().toHtml(parseTextToANSI(line.replaceAll("\x7f", secSign)));
  }

  return line.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
}

function Log({
  time,
  level,
  thread,
  source,
  line,
  thrownMessage,
  simple,
  visible
}: ConsoleLog & {
  simple?: boolean
  visible: boolean
}) {
  const sourceStrArr = source.split(".");
  const sourceName = sourceStrArr[sourceStrArr.length - 1];

  let threadLevelStyle;
  switch(level) {
    case "INFO":
      threadLevelStyle = "text-green-700 dark:text-green-500";
      break;
    case "WARN":
      threadLevelStyle = "text-yellow-700 dark:text-yellow-600";
      break;
    case "ERROR":
      threadLevelStyle = "text-red-700 dark:text-red-400";
      break;
  }

  return (
    <p
      data-slot="terminal-log"
      className={cn(
        "leading-[133%] space-x-1 selection:bg-foreground selection:text-background cursor-default",
        getSettings("terminal.word-wrap") ? "text-wrap wrap-break-word whitespace-pre-wrap" : "whitespace-pre",
        !visible ? "hidden" : "",
        googleSansCode.className
      )}
      style={{ fontSize: getSettings("terminal.font-size") +"px" }}>
      {getSettings("terminal.log-time") && (
        <span className="text-blue-500 dark:text-blue-400">{`[${format(new Date(time), "HH:mm:ss")}]`}</span>
      )}
      {(!simple && getSettings("terminal.thread-name")) && (
        <span className={threadLevelStyle}>{`[${thread}/${level}]`}</span>
      )}
      {(!simple && getSettings("terminal.source-name") && sourceName) && (
        <span className="text-emerald-600 dark:text-emerald-500 max-md:hidden">{`(${sourceName})`}</span>
      )}
      {
        thrownMessage == null
        ? <span dangerouslySetInnerHTML={{ __html: preprocessLogLine(line) }}/>
        : <span dangerouslySetInnerHTML={{ __html: preprocessLogLine(line +"\n"+ thrownMessage) }}/>
      }
    </p>
  );
}

export function TerminalViewer({
  client,
  simple,
  level,
  className
}: {
  client: TerminalClient | null
  simple?: boolean
  level?: ConsoleLogLevel
  className?: string
}) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [, setScrolling] = useState(false);
  const scrollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const pushLog = (log: ConsoleLog) => {
    setLogs((current) => {
      if(current.length + 1 > MAX_LOG_LINES) current.shift();
      log.line = purifyUnsafeText(log.line);

      if(terminalRef.current) {
        const elem = terminalRef.current;
        if(elem.scrollTop + elem.clientHeight >= elem.scrollHeight - 20) {
          if(scrollingTimerRef.current) {
            clearTimeout(scrollingTimerRef.current);
            scrollingTimerRef.current = null;
          }
          setScrolling(false);
        }
      }
      return [...current, log];
    });
  };

  const clearLogs = () => {
    if(!terminalRef.current) return;

    terminalRef.current.innerHTML = "";
  };

  const handleScroll = useCallback(() => {
    if(!terminalRef.current) return;

    const elem = terminalRef.current;
    setScrolling(() => {
      const scrolling = elem.scrollTop + elem.clientHeight < elem.scrollHeight - 20;
      if(scrolling && scrollingTimerRef.current) {
        clearTimeout(scrollingTimerRef.current);
        scrollingTimerRef.current = null;
      }
      return scrolling;
    });
    
    if(!scrollingTimerRef.current) {
      scrollingTimerRef.current = setTimeout(() => {
        setScrolling(false);
        scrollingTimerRef.current = null;
      }, STOP_SCROLLING_TIME);
    }
  }, []);

  useEffect(() => {
    if(!terminalRef.current) return;

    const elem = terminalRef.current;
    getCurrentState(setScrolling).then((scrolling) => {
      if(!scrolling) {
        elem.scrollTo({ top: elem.scrollHeight });
      }
    });
  }, [logs]);

  useEffect(() => {
    if(!terminalRef.current) return;

    const elem = terminalRef.current;
    elem.addEventListener("scroll", handleScroll);

    return () => {
      if(scrollingTimerRef.current) {
        clearTimeout(scrollingTimerRef.current);
        scrollingTimerRef.current = null;
      }
      elem.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  useEffect(() => {
    if(!client) return;

    client.subscribe("init", (data: ConsoleLog[]) => {
      for(let i = data.length - MAX_LOG_LINES > 0 ? data.length - MAX_LOG_LINES : 0; i < data.length; i++) {
        pushLog(data[i]);
      }
    });

    client.subscribe("log", (data: ConsoleLog) => pushLog(data));

    return () => clearLogs();
  }, [client]);
  
  return (
    <div
      className={cn(className, "border rounded-sm bg-background overflow-auto o-scrollbar p-2")}
      ref={terminalRef}>
      {logs.map((log, i) => (
        <Log
          {...log}
          simple={simple}
          visible={getLogLevelId(log.level) >= getLogLevelId(level ?? defaultLogLevel)}
          key={i}/>
      ))}
    </div>
  );
}
