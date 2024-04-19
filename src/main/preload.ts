// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer } from 'electron';
import { OBSInput, OBSSettings } from '../common/types';

export type Channels = 'ipc-example';

const electronHandler = {
  connect: (): Promise<void> => ipcRenderer.invoke('connect'),
  getConnected: (): Promise<boolean> => ipcRenderer.invoke('getConnected'),
  getInputs: (): Promise<OBSInput[]> => ipcRenderer.invoke('getInputs'),
  getObsSettings: (): Promise<OBSSettings> =>
    ipcRenderer.invoke('getObsSettings'),
  setObsSettings: (newObsSettings: OBSSettings): Promise<void> =>
    ipcRenderer.invoke('setObsSettings', newObsSettings),
  getSpectateEndpoint: (): Promise<string> =>
    ipcRenderer.invoke('getSpectateEndpoint'),
  setSpectateEndpoint: (newSpectateEndpoint: string): Promise<void> =>
    ipcRenderer.invoke('setSpectateEndpoint', newSpectateEndpoint),
  getVersion: (): Promise<string> => ipcRenderer.invoke('getVersion'),
  getLatestVersion: (): Promise<string> =>
    ipcRenderer.invoke('getLatestVersion'),
  onDisconnect: (callback: () => void) => {
    ipcRenderer.removeAllListeners('disconnect');
    ipcRenderer.on('disconnect', callback);
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
