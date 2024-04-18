// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer } from 'electron';
import { OBSInput, OBSSettings } from '../common/types';

export type Channels = 'ipc-example';

const electronHandler = {
  connect: (): Promise<void> => ipcRenderer.invoke('connect'),
  getInputs: (): Promise<OBSInput[]> => ipcRenderer.invoke('getInputs'),
  getObsSettings: (): Promise<OBSSettings> =>
    ipcRenderer.invoke('getObsSettings'),
  setObsSettings: (newObsSettings: OBSSettings): Promise<void> =>
    ipcRenderer.invoke('setObsSettings', newObsSettings),
  getVersion: (): Promise<string> => ipcRenderer.invoke('getVersion'),
  getLatestVersion: (): Promise<string> =>
    ipcRenderer.invoke('getLatestVersion'),
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
