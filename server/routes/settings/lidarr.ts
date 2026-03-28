import {
  buildOrpheusServiceDetails,
  getOrpheusExecutable,
  getOrpheusModule,
  getOrpheusScriptPath,
  getOrpheusWorkingDirectory,
  validateOrpheusSettings,
} from '@server/lib/orpheus';
import type { LidarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { Router } from 'express';
import path from 'path';

const lidarrRoutes = Router();

lidarrRoutes.get('/', (_req, res) => {
  const settings = getSettings();

  res.status(200).json(settings.lidarr);
});

lidarrRoutes.post('/', async (req, res) => {
  const settings = getSettings();

  const newLidarr = req.body as LidarrSettings;
  const lastItem = settings.lidarr[settings.lidarr.length - 1];
  newLidarr.id = lastItem ? lastItem.id + 1 : 0;

  if (req.body.isDefault) {
    settings.lidarr.forEach((lidarrInstance) => {
      lidarrInstance.isDefault = false;
    });
  }

  settings.lidarr = [...settings.lidarr, newLidarr];
  await settings.save();

  return res.status(201).json(newLidarr);
});

lidarrRoutes.post<
  undefined,
  Record<string, unknown>,
  LidarrSettings & { tagLabel?: string }
>('/test', async (req, res, next) => {
  try {
    await validateOrpheusSettings(req.body);
    const details = buildOrpheusServiceDetails(req.body);
    const workingDirectory = getOrpheusWorkingDirectory(req.body);

    return res.status(200).json({
      ...details,
      metadataProfiles: [],
      urlBase: req.body.externalUrl,
      executablePath: getOrpheusExecutable(req.body),
      scriptPath: path.resolve(
        workingDirectory,
        getOrpheusScriptPath(req.body)
      ),
      workingDirectory,
      moduleName: getOrpheusModule(req.body),
    });
  } catch (e) {
    logger.error('Failed to validate OrpheusDL', {
      label: 'OrpheusDL',
      message: e.message,
    });
    next({ status: 500, message: 'Failed to validate OrpheusDL settings' });
  }
});

lidarrRoutes.put<{ id: string }, LidarrSettings, LidarrSettings>(
  '/:id',
  async (req, res, next) => {
    const settings = getSettings();

    const lidarrIndex = settings.lidarr.findIndex(
      (r) => r.id === Number(req.params.id)
    );

    if (lidarrIndex === -1) {
      return next({ status: '404', message: 'Settings instance not found' });
    }

    if (req.body.isDefault) {
      settings.lidarr.forEach((lidarrInstance) => {
        lidarrInstance.isDefault = false;
      });
    }

    settings.lidarr[lidarrIndex] = {
      ...req.body,
      id: Number(req.params.id),
    } as LidarrSettings;
    await settings.save();

    return res.status(200).json(settings.lidarr[lidarrIndex]);
  }
);

lidarrRoutes.get<{ id: string }>('/:id/profiles', async (req, res, next) => {
  const settings = getSettings();

  const lidarrSettings = settings.lidarr.find(
    (r) => r.id === Number(req.params.id)
  );

  if (!lidarrSettings) {
    return next({ status: '404', message: 'Settings instance not found' });
  }

  const { profiles } = buildOrpheusServiceDetails(lidarrSettings);

  return res.status(200).json(
    profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
    }))
  );
});

lidarrRoutes.delete<{ id: string }>('/:id', async (req, res, next) => {
  const settings = getSettings();

  const lidarrIndex = settings.lidarr.findIndex(
    (r) => r.id === Number(req.params.id)
  );

  if (lidarrIndex === -1) {
    return next({ status: '404', message: 'Settings instance not found' });
  }

  const removed = settings.lidarr.splice(lidarrIndex, 1);
  await settings.save();

  return res.status(200).json(removed[0]);
});

export default lidarrRoutes;
