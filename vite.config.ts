import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy:
        env.VITE_USE_EMULATORS === "true"
          ? {
              "/api": {
                target: "http://127.0.0.1:5001",
                rewrite: (path) =>
                  `/demo-glengarry-clg/europe-west2/api${path}`,
              },
            }
          : undefined,
    },
  };
});
