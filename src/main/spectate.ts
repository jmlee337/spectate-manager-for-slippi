import EventEmitter from 'events';
import { client as Client, connection as Connection } from 'websocket';
import { Broadcast, SpectatingBroadcast } from '../common/types';

const TIMEOUT_MS = 5000;

export default class SpectateWebSocket extends EventEmitter {
  private client: Client;

  private connection: Connection | null;

  private spectatingBroadcasts: SpectatingBroadcast[];

  constructor() {
    super();

    this.client = new Client();
    this.connection = null;
    this.spectatingBroadcasts = [];
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
          this.emit('close');
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
                    this.spectatingBroadcasts.push({ broadcastId, dolphinId });
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

    return new Array(...this.spectatingBroadcasts);
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
        if (message.type === 'utf8') {
          const json = JSON.parse(message.utf8Data);
          if (json.op === 'list-broadcasts-response') {
            const { broadcasts } = json;
            if (Array.isArray(broadcasts)) {
              clearTimeout(timeout);
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
}
