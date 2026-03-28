export interface TidalApiResponse<T> {
  ok: boolean;
  data: T;
  error?: string;
}

export interface TidalArtist {
  id: number | string;
  name: string;
  picture?: string;
  pictureUrl?: string;
}

export interface TidalAlbum {
  id: number | string;
  title: string;
  name?: string;
  type?: string;
  releaseDate?: string;
  numberOfTracks?: number;
  duration?: number;
  cover?: string;
  coverUrl?: string;
  artists?: TidalArtist[];
  artist?: TidalArtist;
}

export interface TidalTrack {
  id: number | string;
  title?: string;
  name?: string;
  duration?: number;
  trackNumber?: number;
  volumeNumber?: number;
  artists?: TidalArtist[];
}

export interface TidalTrackListItem {
  item: TidalTrack & {
    album?: TidalAlbum;
    explicit?: boolean;
  };
  type?: string;
}

export interface TidalSearchSection<T> {
  items: T[];
  totalNumberOfItems?: number;
  cacheable?: boolean;
}

export interface TidalSearchData {
  query: string;
  types: string[];
  limit: number;
  offset: number;
  results: {
    albums?: TidalSearchSection<TidalAlbum>;
    artists?: TidalSearchSection<TidalArtist>;
    tracks?: TidalSearchSection<TidalTrack>;
    playlists?: TidalSearchSection<Record<string, unknown>>;
  };
}

export interface TidalAlbumPageData {
  albumId: string;
  album: TidalAlbum;
  tracks: TidalTrackListItem[];
  page?: Record<string, unknown>;
}
