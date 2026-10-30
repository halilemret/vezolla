import { getSeoGeoSettings } from "@/modules/seo/service";

export async function StoreStructuredData() {
  const settings = await getSeoGeoSettings();
  const baseUrl = settings.canonicalBaseUrl.replace(/\/$/, "");

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${baseUrl}#organization`,
    name: settings.brandEntityName,
    url: baseUrl,
    logo: settings.ogImageUrl.startsWith("http")
      ? settings.ogImageUrl
      : `${baseUrl}${settings.ogImageUrl}`,
    sameAs: settings.brandSameAsLinks,
  };

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": `${baseUrl}#store`,
    name: settings.brandEntityName,
    url: baseUrl,
    image: settings.ogImageUrl.startsWith("http")
      ? settings.ogImageUrl
      : `${baseUrl}${settings.ogImageUrl}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.geoStreetAddress,
      addressLocality: settings.geoTargetRegion,
      postalCode: settings.geoPostalCode,
      addressCountry: settings.geoTargetCountry,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: settings.geoLatitude,
      longitude: settings.geoLongitude,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ],
        opens: "09:00",
        closes: "18:00",
      },
    ],
    priceRange: settings.priceRange,
    areaServed: settings.serviceAreaCities,
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${baseUrl}#website`,
    name: settings.defaultTitle,
    url: baseUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${baseUrl}/katalog?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const schemas = [organizationSchema, localBusinessSchema, websiteSchema];

  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
