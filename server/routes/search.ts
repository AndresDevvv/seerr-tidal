import TheMovieDb from '@server/api/themoviedb';
import TidalAPI from '@server/api/tidal';
import Media from '@server/entity/Media';
import {
  findSearchProvider,
  type CombinedSearchResponse,
} from '@server/lib/search';
import logger from '@server/logger';
import { mapSearchResults, type Results } from '@server/models/Search';
import { Router } from 'express';

const searchRoutes = Router();

searchRoutes.get('/', async (req, res, next) => {
  const queryString = req.query.query as string;
  const page = Number(req.query.page) || 1;
  const language = (req.query.language as string) ?? req.locale;

  try {
    const searchProvider = findSearchProvider(queryString.toLowerCase());
    let results:
      | CombinedSearchResponse
      | {
          page: number;
          total_pages: number;
          total_results: number;
          results: Results[];
        };

    if (searchProvider) {
      const [id] = queryString
        .toLowerCase()
        .match(searchProvider.pattern) as RegExpMatchArray;
      results = await searchProvider.search({
        id,
        language,
        query: queryString,
      });
    } else {
      const tmdb = new TheMovieDb();
      const tidal = new TidalAPI();

      const responses = await Promise.allSettled([
        tmdb.searchMulti({
          query: queryString,
          page,
          language,
        }),
        page === 1
          ? tidal.search({
              query: queryString,
              types: ['albums', 'artists'],
              limit: 20,
            })
          : Promise.resolve(null),
      ]);

      const tmdbResults =
        responses[0].status === 'fulfilled'
          ? responses[0].value
          : { page: 1, results: [], total_pages: 1, total_results: 0 };
      const tidalResults =
        responses[1].status === 'fulfilled' ? responses[1].value : null;

      const movieTvIds = tmdbResults.results
        .filter(
          (result) =>
            result.media_type === 'movie' || result.media_type === 'tv'
        )
        .map((result) => Number(result.id));

      const movieTvMedia =
        movieTvIds.length > 0
          ? await Media.getRelatedMedia(req.user, movieTvIds)
          : [];

      const tmdbMapped = await mapSearchResults(
        tmdbResults.results,
        movieTvMedia
      );

      const tidalMapped: Results[] =
        page !== 1 || !tidalResults
          ? []
          : [
              ...(tidalResults.results.albums?.items ?? []).map((album) => ({
                id: album.id.toString(),
                score: (album as { popularity?: number }).popularity ?? 0,
                mediaType: 'album' as const,
                externalSource: 'tidal' as const,
                title: album.title,
                'primary-type':
                  (album.type as 'Album' | 'Single' | 'EP') || 'Album',
                'first-release-date': album.releaseDate ?? '',
                releaseDate: album.releaseDate,
                'artist-credit': (album.artists ?? []).map((artist) => ({
                  name: artist.name,
                  artist: {
                    id: artist.id.toString(),
                    name: artist.name,
                    'sort-name': artist.name,
                  },
                })),
                posterPath: album.coverUrl,
                needsCoverArt: !album.coverUrl,
              })),
              ...(tidalResults.results.artists?.items ?? []).map((artist) => ({
                id: artist.name,
                score: (artist as { popularity?: number }).popularity ?? 0,
                mediaType: 'artist' as const,
                externalSource: 'tidal' as const,
                name: artist.name,
                type: 'Group' as const,
                'sort-name': artist.name,
                artistThumb: artist.pictureUrl ?? null,
                artistBackdrop: artist.pictureUrl ?? null,
              })),
            ];

      const totalItems = tmdbResults.total_results + tidalMapped.length;
      const totalPages = Math.max(
        tmdbResults.total_pages,
        Math.ceil(totalItems / 20)
      );

      results = {
        page: tmdbResults.page,
        total_pages: totalPages,
        total_results: totalItems,
        results: [...tmdbMapped, ...tidalMapped],
      };
    }

    const rawResults = results.results as (Results & {
      media_type?: string;
      mediaType?: string;
      id: string | number;
    })[];

    if (rawResults.some((result) => !!result.media_type)) {
      const movieTvIds = rawResults
        .filter(
          (result) =>
            result.media_type === 'movie' || result.media_type === 'tv'
        )
        .map((result) => Number(result.id));

      const musicIds = rawResults
        .filter(
          (result) =>
            result.media_type === 'album' || result.media_type === 'artist'
        )
        .map((result) => result.id.toString());

      const [movieTvMedia, musicMedia] = await Promise.all([
        movieTvIds.length > 0
          ? Media.getRelatedMedia(req.user, movieTvIds)
          : [],
        musicIds.length > 0 ? Media.getRelatedMedia(req.user, musicIds) : [],
      ]);

      const mappedResults = await mapSearchResults(results.results as never, [
        ...movieTvMedia,
        ...musicMedia,
      ]);

      return res.status(200).json({
        page: results.page,
        totalPages: results.total_pages,
        totalResults: results.total_results,
        results: mappedResults,
      });
    }

    return res.status(200).json({
      page: results.page,
      totalPages: results.total_pages,
      totalResults: results.total_results,
      results: results.results,
    });
  } catch (e) {
    logger.debug('Something went wrong retrieving search results', {
      label: 'API',
      errorMessage: e instanceof Error ? e.message : 'Unknown error',
      query: queryString,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve search results.',
    });
  }
});

searchRoutes.get('/keyword', async (req, res, next) => {
  const tmdb = new TheMovieDb();

  try {
    const results = await tmdb.searchKeyword({
      query: req.query.query as string,
      page: Number(req.query.page),
    });

    return res.status(200).json(results);
  } catch (e) {
    logger.debug('Something went wrong retrieving keyword search results', {
      label: 'API',
      errorMessage: e.message,
      query: req.query.query,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve keyword search results.',
    });
  }
});

searchRoutes.get('/company', async (req, res, next) => {
  const tmdb = new TheMovieDb();

  try {
    const results = await tmdb.searchCompany({
      query: req.query.query as string,
      page: Number(req.query.page),
    });

    return res.status(200).json(results);
  } catch (e) {
    logger.debug('Something went wrong retrieving company search results', {
      label: 'API',
      errorMessage: e.message,
      query: req.query.query,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve company search results.',
    });
  }
});

export default searchRoutes;
