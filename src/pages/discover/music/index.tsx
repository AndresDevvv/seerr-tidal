import Error from '@app/pages/_error';
import type { NextPage } from 'next';

const DiscoverMusicPage: NextPage = () => {
  return <Error statusCode={404} />;
};

export default DiscoverMusicPage;
