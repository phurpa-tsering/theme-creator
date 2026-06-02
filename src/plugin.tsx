import type { CorePluginContext } from "@voiden/sdk/ui";
import { Palette } from "lucide-react";
import ThemeEditorScreen from "./ThemeEditorScreen";
import manifest from "../manifest.json";

const PLUGIN_ID = "theme-creator";
const TAB_ID    = "theme-creator-tab";

let cachedTabId: string | null = null;

export default function createThemeCreatorPlugin(context: CorePluginContext) {
  return {
    onload: async () => {
      // Pre-register the panel component so any persisted tab can render on restart
      // without waiting for the status bar button to be clicked.
      context.registerPanel("main", {
        id: TAB_ID,
        title: "Theme Creator",
        component: ThemeEditorScreen,
      });

      context.registerStatusBarItem({
        id: PLUGIN_ID,
        icon: Palette,
        label: "Themes",
        tooltip: "Open Theme Creator",
        position: "right",
        onClick: async () => {
          if (cachedTabId) {
            try {
              await (window as any).electron?.tab.activate("main", cachedTabId);
              return;
            } catch {
              cachedTabId = null;
            }
          }

          cachedTabId = TAB_ID;

          await context.addTab("main", {
            id: TAB_ID,
            icon: "Palette",
            title: "Theme Creator",
            props: {},
            component: ThemeEditorScreen,
          });
        },
      });
    },

    onunload: async () => {
      cachedTabId = null;
    },

    metadata: manifest,
  };
}
