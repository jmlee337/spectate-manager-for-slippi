export type OBSSettings = {
  protocol: 'ws' | 'wss';
  address: string;
  port: string;
  password?: string;
};

export type OBSInput = {
  name: string;
  uuid: string;
};

export type SpectatingBroadcast = {
  broadcastId: string;
  dolphinId: string;
};
