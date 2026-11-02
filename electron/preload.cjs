const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronPlatform', {
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron
});
