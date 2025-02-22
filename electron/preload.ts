import { contextBridge, ipcRenderer } from 'electron';

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args));
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  },

  // You can expose other APTs you need here.
  // ...
  captureScreen() {
    return ipcRenderer.invoke('capture-screen');
  },

  storeGet(key: string) {
    return ipcRenderer.invoke('store-get', key);
  },

  storeSet(key: string, value: any) {
    return ipcRenderer.invoke('store-set', key, value);
  },

  closeFloatingWindow() {
    return ipcRenderer.invoke('close-floating-window');
  },

  openFloatingWindow() {
    return ipcRenderer.invoke('open-floating-window');
  },
});
