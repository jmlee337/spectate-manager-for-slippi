import { BrowserWindow, IpcMainInvokeEvent, app, ipcMain } from 'electron';
import OBSWebSocket from 'obs-websocket-js';
import Store from 'electron-store';
import { OBSInput, OBSSettings } from '../common/types';
import SpectateWebSocket from './spectate';

export default async function setupIPCs(mainWindow: BrowserWindow) {
  const store = new Store();
  let obsSettings: OBSSettings = store.has('obsSettings')
    ? (store.get('obsSettings') as OBSSettings)
    : {
        protocol: 'ws',
        address: '127.0.0.1',
        port: '4455',
      };
  let spectateEndpoint: string = store.has('spectateEndpoint')
    ? (store.get('spectateEndpoint') as string)
    : 'ws://127.0.0.1:49809';

  let connected = false;
  const obsWebSocket = new OBSWebSocket();
  obsWebSocket.on('ConnectionClosed', () => {
    connected = false;
    mainWindow.webContents.send('disconnect');
  });
  const spectateWebSocket = new SpectateWebSocket();
  spectateWebSocket.on('close', () => {
    connected = false;
    mainWindow.webContents.send('disconnect');
  });

  ipcMain.removeHandler('connect');
  ipcMain.handle('connect', async () => {
    const obsWebSocketPromise = obsWebSocket.connect(
      `${obsSettings.protocol}://${obsSettings.address}:${obsSettings.port}`,
      obsSettings.password,
    );
    const spectateWebSocketPromise =
      spectateWebSocket.connect(spectateEndpoint);
    try {
      await obsWebSocketPromise;
    } catch (e: any) {
      throw new Error('Failed to connect to OBS');
    }
    try {
      await spectateWebSocketPromise;
    } catch (e: any) {
      throw new Error('Failed to connect to Spectate Remote Control');
    }
    connected = true;
  });

  ipcMain.removeHandler('getConnected');
  ipcMain.handle('getConnected', () => connected);

  // priority 0: "Match title, otherwise find window of same type"
  // priority 1: "Window title must match"
  // priority 2: "Match title, otherwise find window of same executable" (default)
  // Faster Melee - Slippi (3.4.1) - Playback
  ipcMain.removeHandler('getInputs');
  ipcMain.handle('getInputs', async () => {
    const { inputs } = await obsWebSocket.call('GetInputList', {
      inputKind: 'game_capture',
    });

    const inputNames: OBSInput[] = [];
    const inputPromises = inputs.map(async (input) => {
      const { inputSettings } = await obsWebSocket.call('GetInputSettings', {
        inputUuid: input.inputUuid as string,
      });

      if (
        inputSettings.capture_mode === 'window' &&
        (inputSettings.window as string).startsWith('Faster Melee - Slippi')
      ) {
        inputNames.push({
          name: input.inputName as string,
          uuid: input.inputUuid as string,
        });
      }
    });
    await Promise.all(inputPromises);

    inputNames.sort();
    return inputNames;
  });

  ipcMain.removeHandler('getSpectatingBroadcasts');
  ipcMain.handle('getSpectatingBroadcasts', () =>
    spectateWebSocket.getSpectatingBroadcasts(),
  );

  ipcMain.removeHandler('getObsSettings');
  ipcMain.handle('getObsSettings', () => obsSettings);

  ipcMain.removeHandler('setObsSettings');
  ipcMain.handle(
    'setObsSettings',
    (event: IpcMainInvokeEvent, newObsSettings: OBSSettings) => {
      store.set('obsSettings', newObsSettings);
      obsSettings = newObsSettings;
    },
  );

  ipcMain.removeHandler('getSpectateEndpoint');
  ipcMain.handle('getSpectateEndpoint', () => spectateEndpoint);

  ipcMain.removeHandler('setSpectateEndpoint');
  ipcMain.handle(
    'setSpectateEndpoint',
    (event: IpcMainInvokeEvent, newSpectateEndpoint: string) => {
      store.set('spectateEndpoint', newSpectateEndpoint);
      spectateEndpoint = newSpectateEndpoint;
    },
  );

  ipcMain.removeHandler('getVersion');
  ipcMain.handle('getVersion', () => app.getVersion());

  ipcMain.removeHandler('getLatestVersion');
  ipcMain.handle('getLatestVersion', async () => {
    const response = await fetch(
      'https://api.github.com/repos/jmlee337/spectate-manager-for-slippi/releases',
    );
    const json = await response.json();
    return json[0]?.tag_name || '';
  });
}
