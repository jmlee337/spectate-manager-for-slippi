import { FormEvent, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';
import styled from '@emotion/styled';
import { OBSSettings } from '../common/types';

const Form = styled.form`
  display: flex;
  align-items: center;
  flex-direction: row;
  gap: 8px;
`;

export default function Settings({
  obsSettings,
  setObsSettings,
  spectateEndpoint,
  setSpectateEndpoint,
  dolphinVersion,
  setDolphinVersion,
  appVersion,
  latestAppVersion,
  gotSettings,
}: {
  obsSettings: OBSSettings;
  setObsSettings: (newObsSettings: OBSSettings) => void;
  spectateEndpoint: string;
  setSpectateEndpoint: (newSpectateEndpoint: string) => void;
  dolphinVersion: string;
  setDolphinVersion: (newDolphinVersion: string) => void;
  appVersion: string;
  latestAppVersion: string;
  gotSettings: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  const needUpdate = useMemo(() => {
    if (!appVersion || !latestAppVersion) {
      return false;
    }

    const versionStrArr = appVersion.split('.');
    const latestVersionStrArr = latestAppVersion.split('.');
    if (versionStrArr.length !== 3 || latestVersionStrArr.length !== 3) {
      return false;
    }

    const mapPred = (versionPartStr: string) =>
      Number.parseInt(versionPartStr, 10);
    const versionNumArr = versionStrArr.map(mapPred);
    const latestVersionNumArr = latestVersionStrArr.map(mapPred);
    const somePred = (versionPart: number) => Number.isNaN(versionPart);
    if (versionNumArr.some(somePred) || latestVersionNumArr.some(somePred)) {
      return false;
    }

    if (versionNumArr[0] < latestVersionNumArr[0]) {
      return true;
    }
    if (versionNumArr[1] < latestVersionNumArr[1]) {
      return true;
    }
    if (versionNumArr[2] < latestVersionNumArr[2]) {
      return true;
    }
    return false;
  }, [appVersion, latestAppVersion]);
  if (gotSettings && !hasAutoOpened && (needUpdate || !dolphinVersion)) {
    setOpen(true);
    setHasAutoOpened(true);
  }

  const setNewObsSettings = async (event: FormEvent<HTMLFormElement>) => {
    const target = event.target as typeof event.target & {
      protocol: { value: 'ws' | 'wss' };
      address: { value: string };
      port: { value: string };
      password: { value: string };
    };
    const newObsSettings: OBSSettings = {
      protocol: target.protocol.value,
      address: target.address.value,
      port: target.port.value,
      password: target.password.value || undefined,
    };
    event.preventDefault();
    event.stopPropagation();

    await window.electron.setObsSettings(newObsSettings);
    setObsSettings(newObsSettings);
  };

  return (
    <>
      <Button
        endIcon={<SettingsIcon />}
        onClick={() => {
          setOpen(true);
        }}
        variant="contained"
      >
        Settings
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        fullWidth
        maxWidth="md"
      >
        <Stack
          alignItems="center"
          direction="row"
          justifyContent="space-between"
          marginRight="24px"
        >
          <DialogTitle>Settings</DialogTitle>
          <Typography variant="caption">
            Spectate Manager for Slippi version {appVersion}
          </Typography>
        </Stack>
        <DialogContent sx={{ pt: 0 }}>
          <Stack alignItems="start" spacing="8px">
            <Form onSubmit={setNewObsSettings}>
              <Select
                label="OBS Protocol"
                name="protocol"
                value={obsSettings.protocol}
              >
                <MenuItem value="ws">ws://</MenuItem>
                <MenuItem value="wss">wss://</MenuItem>
              </Select>
              <TextField
                defaultValue={obsSettings.address}
                inputProps={{ maxLength: 15 }}
                label="OBS Address"
                name="address"
                variant="standard"
              />
              <TextField
                defaultValue={obsSettings.port}
                inputProps={{ min: 1, max: 65535 }}
                label="OBS Port"
                name="port"
                type="number"
                variant="standard"
              />
              <TextField
                defaultValue={obsSettings.password}
                label="OBS Password"
                name="password"
                type="password"
                variant="standard"
              />
              <Button type="submit" variant="contained">
                Set!
              </Button>
            </Form>
            <TextField
              label="Spectate Remote Control Endpoint"
              onChange={async (event) => {
                const newSpectateEndpoint = event.target.value;
                await window.electron.setSpectateEndpoint(newSpectateEndpoint);
                setSpectateEndpoint(newSpectateEndpoint);
              }}
              value={spectateEndpoint}
              variant="standard"
            />
            <TextField
              label="Dolphin Version"
              onChange={async (event) => {
                const newDolphinVersion = event.target.value;
                await window.electron.setDolphinVersion(newDolphinVersion);
                setDolphinVersion(newDolphinVersion);
              }}
              value={dolphinVersion}
              variant="standard"
            />
            {!dolphinVersion && (
              <Alert severity="error">
                Unable to fetch dolphin version. Please enter dolphin version
                above (IE. 3.4.1)
              </Alert>
            )}
            {needUpdate && (
              <Alert severity="warning">
                Update available!{' '}
                <a
                  href="https://github.com/jmlee337/spectate-manager-for-slippi/releases/latest"
                  target="_blank"
                  rel="noreferrer"
                >
                  Version {latestAppVersion}
                </a>
              </Alert>
            )}
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
