import React from "react";
import { createRoot } from "react-dom/client";
import { WorkflowArtifactSidePane } from "@/app-shell/WorkflowArtifactSidePane.js";
import { PlatformProvider } from "@/hooks/usePlatform.js";
import { WCodeIntlProvider } from "@/i18n/IntlProvider.js";
import { saveBrowserFile } from "../../../../../web/src/platform/saveBrowserFile.js";
import type { IPlatformService } from "@wcode/shared";
import "@/styles.css";

const params = new URLSearchParams(location.search);
const locale = params.get("locale") === "en-US" ? "en-US" : "zh-CN";
const artifactId = params.get("artifact") === "html" ? "review-html" : "review-file";
const canOpenLocalFiles = params.get("canOpenLocal") === "1";
const supportsEmbeddedBrowser = params.get("embedded") === "1";
document.documentElement.className =
  params.get("theme") === "dark" ? "theme-zai-dark dark" : "theme-zai-light";
const platform = {
  canOpenLocalFiles,
  saveFile: saveBrowserFile,
  ...(canOpenLocalFiles
    ? {
        openExternalFile: async (path: string) => {
          document.body.dataset.openedExternal = path;
          return { success: true };
        },
      }
    : {}),
} as IPlatformService;

createRoot(document.getElementById("root")!).render(
  <WCodeIntlProvider initialLocale={locale}>
    <PlatformProvider platform={platform}>
      <WorkflowArtifactSidePane
        tab={{
          id: "workflow-artifact:review",
          type: "workflow-artifact",
          workspaceKey: "/workspace",
          workspacePath: "/workspace",
          parentSessionId: "review-parent",
          runId: "review-run",
          artifactId,
        }}
        supportsEmbeddedBrowser={supportsEmbeddedBrowser}
        onOpenBrowserUrl={(url) => {
          document.body.dataset.openedBrowserUrl = url;
        }}
        onRevealFileInTree={(path) => {
          document.body.dataset.revealed = path;
        }}
      />
    </PlatformProvider>
  </WCodeIntlProvider>,
);
