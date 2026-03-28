import type { LidarrSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export const ORPHEUS_TIDAL_PROFILES = [
  { id: 1, name: 'minimum' },
  { id: 2, name: 'low' },
  { id: 3, name: 'medium' },
  { id: 4, name: 'high' },
  { id: 5, name: 'lossless' },
  { id: 6, name: 'hifi' },
] as const;

export const DEFAULT_ORPHEUS_SCRIPT = 'orpheus.py';
export const DEFAULT_ORPHEUS_MODULE = 'tidal';
export const DEFAULT_ORPHEUS_WORKDIR = path.join(
  process.cwd(),
  'vendor',
  'orpheusdl-core'
);
export const DEFAULT_ORPHEUS_EXECUTABLE = path.join(
  DEFAULT_ORPHEUS_WORKDIR,
  '.venv',
  'bin',
  'python'
);
export const DEFAULT_ORPHEUS_DOWNLOAD_DIR = path.join(
  process.cwd(),
  'downloads',
  'music'
);

type OrpheusOverrides = {
  downloadPath?: string;
  profileId?: number;
};

const getProfileName = (profileId?: number): string => {
  return (
    ORPHEUS_TIDAL_PROFILES.find((profile) => profile.id === profileId)?.name ??
    'lossless'
  );
};

export const getOrpheusWorkingDirectory = (
  settings: LidarrSettings
): string => {
  return settings.workingDirectory?.trim() || DEFAULT_ORPHEUS_WORKDIR;
};

export const getOrpheusScriptPath = (settings: LidarrSettings): string => {
  return settings.scriptPath?.trim() || DEFAULT_ORPHEUS_SCRIPT;
};

export const getOrpheusExecutable = (settings: LidarrSettings): string => {
  return settings.executablePath?.trim() || DEFAULT_ORPHEUS_EXECUTABLE;
};

export const getOrpheusModule = (settings: LidarrSettings): string => {
  return settings.moduleName?.trim() || DEFAULT_ORPHEUS_MODULE;
};

export const getResolvedOrpheusScriptPath = (
  settings: LidarrSettings
): string => {
  return path.resolve(
    getOrpheusWorkingDirectory(settings),
    getOrpheusScriptPath(settings)
  );
};

export const validateOrpheusSettings = async (
  settings: LidarrSettings
): Promise<void> => {
  const workingDirectory = getOrpheusWorkingDirectory(settings);
  const scriptPath = getResolvedOrpheusScriptPath(settings);
  const modulePath = path.resolve(
    workingDirectory,
    'modules',
    getOrpheusModule(settings)
  );
  await fs.access(workingDirectory);
  await fs.access(scriptPath);
  await fs.access(modulePath);
};

const spawnOrpheus = async (
  settings: LidarrSettings,
  args: string[]
): Promise<{ stdout: string; stderr: string }> => {
  const workingDirectory = getOrpheusWorkingDirectory(settings);
  const executablePath = getOrpheusExecutable(settings);

  return new Promise((resolve, reject) => {
    const child = spawn(executablePath, args, {
      cwd: workingDirectory,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          stderr.trim() ||
            stdout.trim() ||
            `OrpheusDL exited with status code ${code ?? 'unknown'}`
        )
      );
    });
  });
};

const ensureOrpheusConfig = async (settings: LidarrSettings): Promise<void> => {
  const workingDirectory = getOrpheusWorkingDirectory(settings);
  const configPath = path.resolve(workingDirectory, 'config', 'settings.json');

  try {
    await fs.access(configPath);
    return;
  } catch {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await spawnOrpheus(settings, [
      getResolvedOrpheusScriptPath(settings),
      'settings',
      'refresh',
    ]);
  }
};

const updateOrpheusConfig = async (
  settings: LidarrSettings,
  overrides: OrpheusOverrides = {}
): Promise<void> => {
  const workingDirectory = getOrpheusWorkingDirectory(settings);
  const configPath = path.resolve(workingDirectory, 'config', 'settings.json');
  const downloadPath =
    overrides.downloadPath?.trim() ||
    settings.activeDirectory ||
    DEFAULT_ORPHEUS_DOWNLOAD_DIR;

  await ensureOrpheusConfig(settings);
  await fs.mkdir(downloadPath, { recursive: true });
  const rawConfig = await fs.readFile(configPath, 'utf8');
  const config = JSON.parse(rawConfig) as OrpheusConfig;

  config.global ??= {};
  config.global.general ??= {};

  config.global.general.download_quality = getProfileName(
    overrides.profileId ?? settings.activeProfileId
  );
  config.global.general.download_path = downloadPath;

  await fs.writeFile(
    configPath,
    `${JSON.stringify(config, null, 2)}\n`,
    'utf8'
  );
};

export const buildOrpheusServiceDetails = (settings: LidarrSettings) => ({
  profiles: ORPHEUS_TIDAL_PROFILES.map((profile) => ({ ...profile })),
  rootFolders: settings.activeDirectory
    ? [
        {
          id: 0,
          path: settings.activeDirectory,
        },
      ]
    : [
        {
          id: 0,
          path: DEFAULT_ORPHEUS_DOWNLOAD_DIR,
        },
      ],
  tags: [],
});

export const runOrpheusTidalDownload = async (
  settings: LidarrSettings,
  {
    artistName,
    albumName,
    overrides = {},
  }: {
    artistName: string;
    albumName: string;
    overrides?: OrpheusOverrides;
  }
): Promise<{ stdout: string; stderr: string }> => {
  await validateOrpheusSettings(settings);
  await updateOrpheusConfig(settings, overrides);

  const scriptPath = getResolvedOrpheusScriptPath(settings);
  const moduleName = getOrpheusModule(settings);
  const query = `${artistName} ${albumName}`.trim();

  try {
    return await spawnOrpheus(settings, [
      scriptPath,
      'luckysearch',
      moduleName,
      'album',
      query,
    ]);
  } catch (error) {
    logger.error('OrpheusDL command failed', {
      label: 'OrpheusDL',
      errorMessage: error instanceof Error ? error.message : String(error),
      artistName,
      albumName,
    });
    throw error;
  }
};
type OrpheusConfig = {
  global?: {
    general?: {
      download_path?: string;
      download_quality?: string;
    };
  };
  [key: string]: unknown;
};
