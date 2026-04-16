import { Helmet } from 'react-helmet-async';

const BASE_URL = 'https://www.ztvlivestream.com';

const defaultMeta = {
  title: 'ZTVLIVE | Free 24/7 Live TV - Music, Sports, Podcasts & Entertainment',
  description: 'Stream ZTVLIVE free 24/7! Watch live music, sports highlights, podcasts, gaming & viral entertainment. Available on Web, Roku, Fire TV, Samsung & LG Smart TVs.',
  image: `${BASE_URL}/ZTVLIVE_Background_1920x1080.png`,
};

export function SEO({ 
  title, 
  description, 
  image, 
  path = '',
  type = 'website',
  noindex = false 
}) {
  const pageTitle = title ? `${title} | ZTVLIVE` : defaultMeta.title;
  const pageDescription = description || defaultMeta.description;
  const pageImage = image || defaultMeta.image;
  const canonicalUrl = `${BASE_URL}${path}`;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Robots */}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
      )}
      
      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:image" content={pageImage} />
      <meta property="og:site_name" content="ZTVLIVE" />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
      <meta name="twitter:image" content={pageImage} />
    </Helmet>
  );
}

export default SEO;
