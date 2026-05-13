import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-allowance",
  description: "Family allowance tracker with chore verification, no account, mesh-synced",
  accentHex: "#ec4899",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
