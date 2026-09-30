import { defineConfig } from 'vite';

// Merge preview into your existing config; preserve plugins and other settings.
export default defineConfig({
  preview: {
    allowedHosts: ['REPLACE_WITH_YOUR_ENDPOINT_HOSTNAME'],
  },
});
