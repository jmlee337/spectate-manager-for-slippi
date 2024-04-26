export type OBSSettings = {
  protocol: 'ws' | 'wss';
  address: string;
  port: string;
  password?: string;
};

export type OBSInput = {
  name: string;
  uuid: string;
  windowParts: string[];
};

export type SpectatingBroadcast = {
  broadcastId: string;
  dolphinId: string;
};

export type Broadcast = {
  id: string;
  name: string; // connect code
  broadcaster: {
    uid: string;
    name: string; // display name
  };
};
