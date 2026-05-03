"use client";

import { useEffect } from "react";
import { Editor, type EditorProps } from "@monaco-editor/react";
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

monaco.editor.defineTheme("opanel-theme", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#FFFFFF",
    "editor.selectionBackground": "#d9d9d9ee",
  }
});
monaco.editor.defineTheme("opanel-theme-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#0a0a0a",
    "editor.selectionBackground": "#3b3b3bee",
  }
});
monaco.editor.defineTheme("opanel-theme-dark-default", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.selectionBackground": "#3b3b3bee",
  }
});

// server-log language support
monaco.languages.register({ id: "server-log" });
monaco.languages.setMonarchTokensProvider("server-log", {
  tokenizer: {
    root: [
      /* log time */
      [/^\[\d+:\d+:\d+\]/, "log.time"], // common format
      [/^\[.*\d+:\d+:\d+.\d+\]/, "log.time"], // forge
      /* log thread & log level */
      [/\[[\w\s\d-#]+\/INFO\]:?/, "log.level.info"], // info
      [/\[[\w\s\d-#]+\/WARN\].*/, "log.level.warn"], // warning
      [/\[[\w\s\d-#]+\/(ERROR|FATAL)\].*/, "log.level.error"], // error
      /* log source */
      [/\[[\w.]+\/\w*\]:/, "log.source"],
      /* stacktrace */
      [/^(\sat )/, "log.stacktrace"],
      [/^Caused by:.*/, "log.stacktrace.cause"],
    ]
  }
});
monaco.languages.setLanguageConfiguration("server-log", {
  brackets: [["(", ")"]]
});
monaco.editor.defineTheme("server-log-theme", {
  base: "vs",
  inherit: true,
  rules: [
    { token: "log.time", foreground: "7A7A7A" },
    { token: "log.level.info", foreground: "008000" },
    { token: "log.level.warn", foreground: "B37E1B" },
    { token: "log.level.error", foreground: "E00000" },
    { token: "log.source", foreground: "7A7A7A" },
    { token: "log.stacktrace", foreground: "E00000" },
    { token: "log.stacktrace.cause", foreground: "E00000", fontStyle: "bold" },
  ],
  colors: {
    "editor.background": "#FFFFFF",
    "editor.selectionBackground": "#d9d9d9ee",
  }
});
monaco.editor.defineTheme("server-log-theme-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "log.time", foreground: "7A7A7A" },
    { token: "log.level.info", foreground: "608B4E" },
    { token: "log.level.warn", foreground: "CBA228" },
    { token: "log.level.error", foreground: "DD6A6F" },
    { token: "log.source", foreground: "7A7A7A" },
    { token: "log.stacktrace", foreground: "DD6A6F" },
    { token: "log.stacktrace.cause", foreground: "DD6A6F", fontStyle: "bold" },
  ],
  colors: {
    "editor.background": "#0a0a0a",
    "editor.selectionBackground": "#3b3b3bee",
  }
});

export default function MonacoEditor({
  onMount,
  autoFitHeight = false,
  ...props
}: EditorProps & {
  autoFitHeight?: boolean
}) {
  useEffect(() => {
    if(typeof window === "undefined") return;

    document.fonts.ready.then(() => {
      monaco.editor.remeasureFonts();
    });

    (window as any).MonacoEnvironment = {
      getWorker: (_workerId: never, label: string) => {
        switch(label) {
          case "json":
            return new Worker(
              new URL("monaco-editor/esm/vs/language/json/json.worker", import.meta.url)
            );
          case "typescript":
          case "ts":
            return new Worker(
              new URL("monaco-editor/esm/vs/language/typescript/ts.worker", import.meta.url)
            );
          case "yaml":
            return new Worker(
              new URL("monaco-yaml/yaml.worker", import.meta.url)
            );
          default:
            return new Worker(
              new URL("monaco-editor/esm/vs/editor/editor.worker", import.meta.url)
            );
        }
      }
    };
  }, []);

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    if(!autoFitHeight) return;

    const container = editor.getDomNode();
    if(!container) return;

    const lineCount = editor.getModel()?.getLineCount() ?? 1;
    const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
    const fitHeight = lineCount * lineHeight + editor.getOption(monaco.editor.EditorOption.padding).top + editor.getOption(monaco.editor.EditorOption.padding).bottom;
    container.style.height = `${fitHeight}px`;
    editor.layout();
  };

  loader.config({ monaco });
  return (
    <Editor
      onMount={(editor, monaco) => {
        handleEditorDidMount(editor);
        onMount && onMount(editor, monaco);
      }}
      {...props}/>
  );
}
