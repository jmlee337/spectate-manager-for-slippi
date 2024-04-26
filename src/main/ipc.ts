import { BrowserWindow, IpcMainInvokeEvent, app, ipcMain } from 'electron';
import OBSWebSocket, { RequestBatchRequest } from 'obs-websocket-js';
import Store from 'electron-store';
import { OBSInput, OBSSettings } from '../common/types';
import SpectateWebSocket from './spectate';
import { dolphinPrefix } from '../common/constants';

async function fetchDolphinVersion() {
  const response = await fetch(
    'https://api.github.com/repos/project-slippi/Ishiiruka-Playback/releases',
  );
  const json = await response.json();
  const tagName: string = json[0]?.tag_name;
  if (tagName && tagName.startsWith('v')) {
    return tagName.slice(1);
  }
  return '';
}

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
  let dolphinVersion = await fetchDolphinVersion();

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
  const uuidToObsInputs = new Map<string, OBSInput>();
  ipcMain.removeHandler('getInputs');
  ipcMain.handle('getInputs', async () => {
    const { inputs } = await obsWebSocket.call('GetInputList', {
      inputKind: 'game_capture',
    });

    const obsInputs: OBSInput[] = [];
    const inputPromises = inputs.map(async (input) => {
      const { inputSettings } = await obsWebSocket.call('GetInputSettings', {
        inputUuid: input.inputUuid as string,
      });

      /**
       * {
       *   "capture_mode":"window",
       *   "priority":1,
       *   "window":"Faster Melee - Slippi (3.4.1) - Playback | LEE#22337:wxWindowNR:Slippi Dolphin.exe"
       * }
       */
      if (
        inputSettings.capture_mode === 'window' &&
        inputSettings.priority === 1 &&
        typeof inputSettings.window === 'string' &&
        inputSettings.window.startsWith('Faster Melee - Slippi')
      ) {
        const windowParts = inputSettings.window.split(':');
        if (windowParts.length === 3) {
          obsInputs.push({
            name: input.inputName as string,
            uuid: input.inputUuid as string,
            windowParts,
          });
        }
      }
    });
    await Promise.all(inputPromises);

    uuidToObsInputs.clear();
    obsInputs.forEach((obsInput) => {
      uuidToObsInputs.set(obsInput.uuid, obsInput);
    });

    obsInputs.sort();
    return obsInputs;
  });

  ipcMain.removeHandler('getSpectatingBroadcasts');
  ipcMain.handle('getSpectatingBroadcasts', () =>
    spectateWebSocket.getSpectatingBroadcasts(),
  );

  ipcMain.removeHandler('getBroadcasts');
  ipcMain.handle('getBroadcasts', () => spectateWebSocket.getBroadcasts());

  ipcMain.removeHandler('putBroadcastInInput');
  ipcMain.handle(
    'putBroadcastInInput',
    async (event: IpcMainInvokeEvent, broadcastId: string, uuid: string) => {
      const requestObsInput = uuidToObsInputs.get(uuid);
      if (!requestObsInput) {
        throw new Error('uuid not found');
      }

      let requestDolphinId: string | undefined;
      const requestObsTitleParts = requestObsInput.windowParts[0].split(' | ');
      if (
        requestObsTitleParts.length === 2 &&
        requestObsTitleParts[1].startsWith(dolphinPrefix)
      ) {
        [, requestDolphinId] = requestObsTitleParts;
      }

      const actualDolphinId = await spectateWebSocket.spectateBroadcast(
        broadcastId,
        requestDolphinId,
      );
      if (actualDolphinId !== requestDolphinId) {
        const requests: RequestBatchRequest[] = [];
        const takeObsInput = Array.from(uuidToObsInputs.values()).find(
          (obsInput) => {
            const titleParts = obsInput.windowParts[0].split(' | ');
            if (titleParts.length === 2 && titleParts[1] === actualDolphinId) {
              return true;
            }
            return false;
          },
        );
        let takeTitle: string | undefined;
        if (takeObsInput) {
          const takeTitleStart = `Faster Melee - Slippi (${dolphinVersion}) - Playback`;
          takeTitle = requestDolphinId
            ? `${takeTitleStart} | ${requestDolphinId}`
            : takeTitleStart;
          const takeWindowParts = [
            takeTitle,
            takeObsInput.windowParts[1],
            takeObsInput.windowParts[2],
          ];
          requests.push({
            requestType: 'SetInputSettings',
            requestData: {
              inputUuid: takeObsInput.uuid,
              inputSettings: {
                window: takeWindowParts.join(':'),
              },
            },
          });
        }

        const requestTitle = `Faster Melee - Slippi (${dolphinVersion}) - Playback | ${actualDolphinId}`;
        const requestWindowParts = [
          requestTitle,
          requestObsInput.windowParts[1],
          requestObsInput.windowParts[2],
        ];
        requests.push({
          requestType: 'SetInputSettings',
          requestData: {
            inputUuid: uuid,
            inputSettings: {
              window: requestWindowParts.join(':'),
            },
          },
        });
        await obsWebSocket.callBatch(requests);

        requestObsInput.windowParts[0] = requestTitle;
        if (takeTitle) {
          takeObsInput!.windowParts[0] = takeTitle;
        }
      }
    },
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

  ipcMain.removeHandler('getDolphinVersion');
  ipcMain.handle('getDolphinVersion', () => dolphinVersion);

  ipcMain.removeHandler('setDolphinVersion');
  ipcMain.handle(
    'setDolphinVersion',
    (event: IpcMainInvokeEvent, newDolphinVersion: string) => {
      dolphinVersion = newDolphinVersion;
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
