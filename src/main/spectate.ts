import EventEmitter from 'events';
import { client as Client, connection as Connection } from 'websocket';
import { Broadcast, SpectatingBroadcast } from '../common/types';
import { dolphinPrefix } from '../common/constants';

const TIMEOUT_MS = 5000;

export default class SpectateWebSocket extends EventEmitter {
  private client: Client;

  private connection: Connection | null;

  private broadcastIdToDolphinId: Map<string, string>;

  private dolphinIdToBroadcastId: Map<string, string>;

  private dolphinOrdinal: number;

  constructor() {
    super();

    this.client = new Client();
    this.connection = null;
    this.broadcastIdToDolphinId = new Map();
    this.dolphinIdToBroadcastId = new Map();
    this.dolphinOrdinal = 0;
  }

  async connect(spectateEndpoint: string) {
    if (this.connection) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      this.client.once('connectFailed', (e: Error) => {
        this.client.removeAllListeners('connect');
        reject(e);
      });
      this.client.once('connect', (connection: Connection) => {
        this.client.removeAllListeners('connectFailed');
        this.connection = connection;
        this.connection.on('close', () => {
          this.connection = null;
          this.broadcastIdToDolphinId.clear();
          this.dolphinIdToBroadcastId.clear();
          this.emit('close');
        });
        this.connection.on('message', (message) => {
          if (message.type === 'utf8') {
            const json = JSON.parse(message.utf8Data);
            const { op, dolphinId } = json;
            if (
              op === 'dolphin-closed-event' &&
              typeof dolphinId === 'string' &&
              this.dolphinIdToBroadcastId.has(dolphinId)
            ) {
              const broadcastId = this.dolphinIdToBroadcastId.get(dolphinId)!;
              this.broadcastIdToDolphinId.delete(broadcastId);
              this.dolphinIdToBroadcastId.delete(dolphinId);
            }
          }
        });
        const timeout = setTimeout(() => {
          this.connection?.close();
          reject();
        }, TIMEOUT_MS);
        this.connection.once('message', (message) => {
          if (message.type === 'utf8') {
            const json = JSON.parse(message.utf8Data);
            if (json.op === 'spectating-broadcasts-event') {
              const newSpectatingBroadcasts = json.spectatingBroadcasts;
              if (Array.isArray(newSpectatingBroadcasts)) {
                clearTimeout(timeout);
                for (let i = 0; i < newSpectatingBroadcasts.length; i += 1) {
                  const { broadcastId, dolphinId } = newSpectatingBroadcasts[i];
                  if (
                    typeof broadcastId === 'string' &&
                    broadcastId.length > 0 &&
                    typeof dolphinId === 'string' &&
                    dolphinId.length > 0
                  ) {
                    this.broadcastIdToDolphinId.set(broadcastId, dolphinId);
                    this.dolphinIdToBroadcastId.set(dolphinId, broadcastId);
                  } else {
                    reject();
                    return;
                  }
                }
                resolve();
                return;
              }
            }
          }
          reject();
        });
      });
      this.client.connect(spectateEndpoint, 'spectate-protocol');
    });
  }

  getSpectatingBroadcasts() {
    if (!this.connection) {
      throw new Error('no connection');
    }

    return Array.from(this.broadcastIdToDolphinId.entries()).map(
      ([broadcastId, dolphinId]): SpectatingBroadcast => ({
        broadcastId,
        dolphinId,
      }),
    );
  }

  async getBroadcasts() {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        reject(new Error('no connection'));
        return;
      }

      // eslint-disable-next-line no-undef
      let timeout: NodeJS.Timeout;
      const listener = (message: any) => {
        clearTimeout(timeout);
        if (message.type === 'utf8') {
          const json = JSON.parse(message.utf8Data);
          if (json.op === 'list-broadcasts-response') {
            const { broadcasts, err } = json;
            if (err) {
              reject(new Error(err));
              return;
            }

            if (Array.isArray(broadcasts)) {
              const newBroadcasts: Broadcast[] = [];
              for (let i = 0; i < broadcasts.length; i += 1) {
                const { id, name, broadcaster } = broadcasts[i];
                if (
                  typeof id === 'string' &&
                  id.length > 0 &&
                  typeof name === 'string' &&
                  name.length > 0 &&
                  typeof broadcaster?.uid === 'string' &&
                  broadcaster?.uid.length > 0 &&
                  typeof broadcaster?.name === 'string' &&
                  broadcaster?.name.length > 0
                ) {
                  newBroadcasts.push({ id, name, broadcaster });
                } else {
                  reject();
                  return;
                }
              }
              resolve(newBroadcasts);
              return;
            }
          }
        }
        reject();
      };
      this.connection.once('message', listener);
      this.connection.send(JSON.stringify({ op: 'list-broadcasts-request' }));
      timeout = setTimeout(() => {
        this.connection?.removeListener('message', listener);
        reject();
      }, TIMEOUT_MS);
    });
  }

  async spectateBroadcast(broadcastId: string, requestDolphinId?: string) {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        reject(new Error('no connection'));
        return;
      }

      const alreadyDolphinId = this.broadcastIdToDolphinId.get(broadcastId);
      if (alreadyDolphinId) {
        resolve(alreadyDolphinId);
        return;
      }

      // eslint-disable-next-line no-undef
      let timeout: NodeJS.Timeout;
      const listener = (message: any) => {
        clearTimeout(timeout);
        if (message.type === 'utf8') {
          const json = JSON.parse(message.utf8Data);
          if (json.op === 'spectate-broadcast-response') {
            const { dolphinId, err } = json;
            if (err) {
              reject(new Error(err));
              return;
            }

            if (typeof dolphinId === 'string' && dolphinId.length > 0) {
              this.broadcastIdToDolphinId.set(broadcastId, dolphinId);
              this.dolphinIdToBroadcastId.set(dolphinId, broadcastId);
              resolve(dolphinId);
              return;
            }
          }
        }
        reject();
      };
      this.connection.once('message', listener);

      const nextDolphinId =
        requestDolphinId || `${dolphinPrefix}${this.dolphinOrdinal}`;
      this.dolphinOrdinal += 1;
      this.connection.send(
        JSON.stringify({
          op: 'spectate-broadcast-request',
          broadcastId,
          dolphinId: nextDolphinId,
        }),
      );

      timeout = setTimeout(() => {
        this.connection?.removeListener('message', listener);
        reject();
      }, TIMEOUT_MS);
    });
  }
}
