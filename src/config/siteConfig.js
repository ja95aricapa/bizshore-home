const FALLBACK_SITE_URL = "https://www.bizshore.net";

export const siteConfig = {
	siteName: "BizShore Solutions SAS",
	defaultLocale: "es_CO",
	siteUrl: import.meta.env.VITE_SITE_URL || FALLBACK_SITE_URL,
	defaultImage: "/og-image.svg",
	contactEmail: "contacto@bizshore.net",
	formspreeEndpoint: import.meta.env.VITE_FORMSPREE_ENDPOINT || "",
};
