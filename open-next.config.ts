import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const cloudflareConfig = defineCloudflareConfig();

const config = {
  ...cloudflareConfig,
  buildCommand: "next build --webpack",
};

export default config;
