// Structured data (schema.org JSON-LD) and canonical-URL helpers.
import { SITE_URL, absoluteUrl } from "../../shared/urls.js";

export const SITE_NAME = "Generation Football";
export const DEFAULT_OG_IMAGE = "/images/logo.png";

// Serialises JSON-LD for a <script> block. "<" is escaped so a name containing
// "</script>" cannot break out of the tag.
export function jsonLd(...objects) {
  const items = objects.flat().filter(Boolean);
  if (!items.length) return "";
  const payload = items.length === 1 ? items[0] : items;
  return JSON.stringify(payload).replace(/</g, "\\u003c");
}

// 301 to the canonical path when the request path differs (wrong or missing
// slug, trailing slash, old season label). The query string is kept.
export function redirectToCanonical(req, res, canonicalPath) {
  const [pathOnly] = canonicalPath.split("?");
  if (req.path === pathOnly) return false;
  const queryIndex = req.originalUrl.indexOf("?");
  const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : "";
  res.redirect(301, pathOnly + query);
  return true;
}

export function breadcrumbList(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], index) => ({
      "@type": "ListItem",
      position: index + 1,
      name,
      item: absoluteUrl(path),
    })),
  };
}

export function websiteSchema() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: `${SITE_URL}/`,
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: absoluteUrl(DEFAULT_OG_IMAGE),
    },
  ];
}

export function teamSchema({ name, path, logoPath, stadium, manager, nationName, isNationalTeam }) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name,
    sport: "Soccer",
    url: absoluteUrl(path),
    logo: logoPath ? absoluteUrl(logoPath) : undefined,
    coach: manager ? { "@type": "Person", name: manager } : undefined,
    // A club is located at its stadium in its country; a national team is the country.
    location: stadium || (!isNationalTeam && nationName)
      ? {
          "@type": "Place",
          name: stadium || nationName,
          address: !isNationalTeam && nationName ? { "@type": "PostalAddress", addressCountry: nationName } : undefined,
        }
      : undefined,
  };
}

export function playerSchema({ name, path, imagePath, clubName, clubPath, nationName, birthDate }) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    url: absoluteUrl(path),
    image: imagePath ? absoluteUrl(imagePath) : undefined,
    nationality: nationName ? { "@type": "Country", name: nationName } : undefined,
    birthDate: birthDate || undefined,
    memberOf: clubName
      ? { "@type": "SportsTeam", name: clubName, url: clubPath ? absoluteUrl(clubPath) : undefined }
      : undefined,
  };
}

export function matchSchema({ path, home, away, startDate, venue, leagueName, finished, homeGoals, awayGoals }) {
  const team = (side) => ({ "@type": "SportsTeam", name: side.name, url: side.path ? absoluteUrl(side.path) : undefined });
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${home.name} vs ${away.name}`,
    sport: "Soccer",
    url: absoluteUrl(path),
    startDate,
    eventStatus: "https://schema.org/EventScheduled",
    location: venue ? { "@type": "Place", name: venue } : undefined,
    homeTeam: team(home),
    awayTeam: team(away),
    competitor: [team(home), team(away)],
    superEvent: leagueName ? { "@type": "SportsEvent", name: leagueName } : undefined,
    description: finished && homeGoals != null && awayGoals != null
      ? `${home.name} ${homeGoals}–${awayGoals} ${away.name}${leagueName ? `, ${leagueName}` : ""}`
      : undefined,
  };
}

export function articleSchema({ title, description, path, imagePath, updated, published }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url: absoluteUrl(path),
    mainEntityOfPage: absoluteUrl(path),
    image: absoluteUrl(imagePath || DEFAULT_OG_IMAGE),
    datePublished: published || updated,
    dateModified: updated,
    author: { "@type": "Organization", name: SITE_NAME, url: `${SITE_URL}/` },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: absoluteUrl(DEFAULT_OG_IMAGE) },
    },
  };
}
