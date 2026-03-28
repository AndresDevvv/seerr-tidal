import ExternalAPI from '@server/api/externalapi';
import type {
  TidalAlbumPageData,
  TidalApiResponse,
  TidalSearchData,
} from '@server/api/tidal/interfaces';
import logger from '@server/logger';

const DEFAULT_TIDAL_API_URL = 'https://tidal.vyxi.org';
const DEFAULT_TIDAL_API_KEY = '239842397462786';

class TidalAPI extends ExternalAPI {
  private apiKey: string;

  constructor() {
    super(
      process.env.TIDAL_API_URL || DEFAULT_TIDAL_API_URL,
      {},
      {
        timeout: 30000,
      }
    );

    this.apiKey = process.env.TIDAL_API_KEY || DEFAULT_TIDAL_API_KEY;
  }

  public async search({
    query,
    types,
    limit = 20,
    offset = 0,
  }: {
    query: string;
    types: ('albums' | 'artists' | 'tracks' | 'playlists')[];
    limit?: number;
    offset?: number;
  }) {
    try {
      const response = await this.get<TidalApiResponse<TidalSearchData>>(
        '/search',
        {
          params: {
            q: query,
            types: types.join(','),
            limit,
            offset,
            key: this.apiKey,
          },
        },
        60
      );

      if (!response.ok) {
        throw new Error(response.error || 'TIDAL search failed');
      }

      return response.data;
    } catch (e) {
      logger.error('[TIDAL] Failed to search', {
        label: 'TIDAL',
        query,
        errorMessage: e instanceof Error ? e.message : 'Unknown error',
      });
      throw e;
    }
  }

  public async getAlbum(albumId: string) {
    try {
      const response = await this.get<TidalApiResponse<TidalAlbumPageData>>(
        `/albums/${albumId}`,
        {
          params: {
            key: this.apiKey,
          },
        },
        300
      );

      if (!response.ok) {
        throw new Error(response.error || 'TIDAL album lookup failed');
      }

      return response.data;
    } catch (e) {
      logger.error('[TIDAL] Failed to fetch album', {
        label: 'TIDAL',
        albumId,
        errorMessage: e instanceof Error ? e.message : 'Unknown error',
      });
      throw e;
    }
  }
}

export default TidalAPI;
