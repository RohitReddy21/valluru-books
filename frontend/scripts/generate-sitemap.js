const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.thevalluru.org';

const staticPages = [
  { url: '/', priority: 1.0, changefreq: 'weekly' },
  { url: '/series', priority: 0.9, changefreq: 'weekly' },
  { url: '/movements', priority: 0.9, changefreq: 'weekly' },
  { url: '/about', priority: 0.7, changefreq: 'monthly' },
];

const booklets = [
  { slug: 'booklet-one-when-the-gods-fall-silent', changefreq: 'monthly' },
  { slug: 'booklet-two-when-silence-became-sound', changefreq: 'monthly' },
  { slug: 'booklet-three-where-language-learns-to-bow', changefreq: 'monthly' },
  { slug: 'booklet-four-when-the-seeker-stops-optimizing', changefreq: 'monthly' },
  { slug: 'booklet-five-the-witnesses-who-remain', changefreq: 'monthly' },
  { slug: 'booklet-six-when-grief-became-nada', changefreq: 'monthly' },
  { slug: 'booklet-seven-beyond-grief', changefreq: 'monthly' },
  { slug: 'booklet-eight-nadesvara-ksobhasamana-stotram', changefreq: 'monthly' },
  { slug: 'booklet-nine-in-ammas-lap', changefreq: 'monthly' },
];

const movements = [
  { slug: 'inward-map', changefreq: 'monthly' },
  { slug: 'seeker-and-bhagavan', changefreq: 'monthly' },
  { slug: 'nada', changefreq: 'monthly' },
  { slug: 'grief-as-fire', changefreq: 'monthly' },
  { slug: 'childs-return', changefreq: 'monthly' },
];

function generateSitemapXml() {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Static pages
  staticPages.forEach((page) => {
    xml += '  <url>\n';
    xml += `    <loc>${BASE_URL}${page.url}</loc>\n`;
    xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += '  </url>\n';
  });

  // Booklet pages
  booklets.forEach((booklet) => {
    xml += '  <url>\n';
    xml += `    <loc>${BASE_URL}/series/${booklet.slug}</loc>\n`;
    xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
    xml += `    <changefreq>${booklet.changefreq}</changefreq>\n`;
    xml += '    <priority>0.8</priority>\n';
    xml += '  </url>\n';
  });

  // Movement pages
  movements.forEach((movement) => {
    xml += '  <url>\n';
    xml += `    <loc>${BASE_URL}/movements/${movement.slug}</loc>\n`;
    xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
    xml += `    <changefreq>${movement.changefreq}</changefreq>\n`;
    xml += '    <priority>0.8</priority>\n';
    xml += '  </url>\n';
  });

  xml += '</urlset>';
  return xml;
}

function generateSitemapIndex() {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  xml += '  <sitemap>\n';
  xml += `    <loc>${BASE_URL}/sitemap.xml</loc>\n`;
  xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
  xml += '  </sitemap>\n';
  xml += '</sitemapindex>';
  return xml;
}

const sitemapXml = generateSitemapXml();
const sitemapPath = path.join(__dirname, '../public/sitemap.xml');

try {
  fs.writeFileSync(sitemapPath, sitemapXml);
  console.log('✓ Sitemap generated successfully:', sitemapPath);
} catch (error) {
  console.error('✗ Error generating sitemap:', error);
  process.exit(1);
}
