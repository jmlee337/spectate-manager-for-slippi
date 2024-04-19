import { client as Client, connection as Connection } from 'websocket';

export default class SpectateWebSocket {
  private client: Client;

  private connection: Connection | null;

  constructor() {
    this.client = new Client();
    this.connection = null;
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
        });
        resolve();
      });
      this.client.connect(spectateEndpoint, 'spectate-protocol');
    });
  }
}