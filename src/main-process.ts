/**
 * theme-creator — Main-Process Plugin
 *
 * Registers two IPC handlers (auto-namespaced by the plugin runtime):
 *   ext:theme-creator:themes:save    — write a custom theme JSON to userData/themes/
 *   ext:theme-creator:themes:delete  — delete a custom theme JSON from userData/themes/
 */

import type { ElectronExtensionContext, ElectronPlugin } from "@voiden/sdk/electron";
import { app } from "electron";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

const BUNDLED_THEME_IDS = new Set([
  "voiden", "voiden-light", "tokyo-night", "dracula", "nord", "iris",
]);

interface Theme {
  id: string;
  name: string;
  type: string;
  colors: Record<string, string>;
}

function getThemesDir(): string {
  return path.join(app.getPath("userData"), "themes");
}

export default function createThemeCreatorMainPlugin(
  ctx: ElectronExtensionContext,
): ElectronPlugin {
  console.log("[theme-creator] Main process factory called");

  return {
    async onload() {
      console.log("[theme-creator] Main process onload starting");
      try {
        // ── themes:save ────────────────────────────────────────────────────────
        ctx.ipc.handle(
          "themes:save",
        async (_event: any, theme: Theme): Promise<{ success: boolean; error?: string }> => {
          if (!theme?.id || !theme?.name) {
            return { success: false, error: "Theme must have an id and name." };
          }
          if (BUNDLED_THEME_IDS.has(theme.id)) {
            return { success: false, error: "Cannot overwrite a built-in theme." };
          }

          try {
            const themesDir = getThemesDir();
            if (!fsSync.existsSync(themesDir)) {
              await fs.mkdir(themesDir, { recursive: true });
            }

            const themePath = path.join(themesDir, `${theme.id}.json`);
            await fs.writeFile(themePath, JSON.stringify(theme, null, 2), "utf8");

            return { success: true };
          } catch (err: any) {
            return {
              success: false,
              error: err instanceof Error ? err.message : "Failed to save theme.",
            };
          }
        },
      );

      // ── themes:delete ──────────────────────────────────────────────────────
      ctx.ipc.handle(
        "themes:delete",
        async (_event: any, themeId: string): Promise<{ success: boolean; error?: string }> => {
          if (BUNDLED_THEME_IDS.has(themeId)) {
            return { success: false, error: "Cannot delete a built-in theme." };
          }

          try {
            const themePath = path.join(getThemesDir(), `${themeId}.json`);
            if (fsSync.existsSync(themePath)) {
              await fs.unlink(themePath);
            }
            return { success: true };
          } catch (err: any) {
            return {
              success: false,
              error: err instanceof Error ? err.message : "Failed to delete theme.",
            };
          }
        },
      );

      console.log("[theme-creator] IPC handlers registered successfully");
      } catch (err) {
      console.error("[theme-creator] Failed to register IPC handlers:", err);
      }
      },
    async onunload() {
      ctx.ipc.removeHandler("themes:save");
      ctx.ipc.removeHandler("themes:delete");
    },
  };
}
