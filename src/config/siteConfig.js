const FALLBACK_SITE_URL = "https://www.bizshore.com";

export const siteConfig = {
	siteName: "BizShore Solutions SAS",
	defaultLocale: "es_CO",
	siteUrl: import.meta.env.VITE_SITE_URL || FALLBACK_SITE_URL,
	defaultImage: "/og-image.svg",
	contactEmail: "contacto@bizshore.com",
	formspreeEndpoint: import.meta.env.VITE_FORMSPREE_ENDPOINT || "",
};
