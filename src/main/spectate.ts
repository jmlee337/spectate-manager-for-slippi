import EventEmitter from 'events';
import { client as Client, connection as Connection } from 'websocket';
import { SpectatingBroadcast } from '../common/types';

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
          reject();
        }, TIMEOUT_MS);
        this.connection.once('message', (message) => {
          if (message.type === 'utf8') {
            const json = JSON.parse(message.utf8Data);
            if (json.op === 'spectating-broadcasts-event') {
              const newSpectatingBroadcasts = json.spectatingBroadcasts;
              if (Array.isArray(newSpectatingBroadcasts)) {
                clearTimeout(timeout);
                newSpectatingBroadcasts.forEach((newSpectatingBroadcast) => {
                  const { broadcastId, dolphinId } = newSpectatingBroadcast;
                  if (
                    typeof broadcastId === 'string' &&
                    broadcastId.length > 0 &&
                    typeof dolphinId === 'string' &&
                    dolphinId.length > 0
                  ) {
                    this.spectatingBroadcasts.push({ broadcastId, dolphinId });
                  }
                });
                resolve();
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
}
