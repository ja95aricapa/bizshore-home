import { useEffect } from "react";
import { siteConfig } from "../config/siteConfig";

function setMetaAttribute(selector, attribute, value, content) {
	let element = document.head.querySelector(selector);

	if (!element) {
		element = document.createElement("meta");
		element.setAttribute(attribute, value);
		document.head.appendChild(element);
	}

	element.setAttribute("content", content);
}

function setCanonical(url) {
	let canonical = document.head.querySelector('link[rel="canonical"]');

	if (!canonical) {
		canonical = document.createElement("link");
		canonical.setAttribute("rel", "canonical");
		document.head.appendChild(canonical);
	}

	canonical.setAttribute("href", url);
}

export function usePageSeo({
	title,
	description,
	path,
	image,
	locale,
	noindex,
}) {
	useEffect(() => {
		const canonicalUrl = `${siteConfig.siteUrl}${path}`;
		const pageTitle = `${title} | ${siteConfig.siteName}`;
		const imageUrl = `${siteConfig.siteUrl}${image || siteConfig.defaultImage}`;

		document.title = pageTitle;

		setMetaAttribute(
			'meta[name="description"]',
			"name",
			"description",
			description,
		);
		setMetaAttribute(
			'meta[property="og:title"]',
			"property",
			"og:title",
			pageTitle,
		);
		setMetaAttribute(
			'meta[property="og:description"]',
			"property",
			"og:description",
			description,
		);
		setMetaAttribute(
			'meta[property="og:type"]',
			"property",
			"og:type",
			"website",
		);
		setMetaAttribute(
			'meta[property="og:url"]',
			"property",
			"og:url",
			canonicalUrl,
		);
		setMetaAttribute(
			'meta[property="og:image"]',
			"property",
			"og:image",
			imageUrl,
		);
		setMetaAttribute(
			'meta[name="twitter:card"]',
			"name",
			"twitter:card",
			"summary_large_image",
		);
		setMetaAttribute(
			'meta[name="twitter:title"]',
			"name",
			"twitter:title",
			pageTitle,
		);
		setMetaAttribute(
			'meta[name="twitter:description"]',
			"name",
			"twitter:description",
			description,
		);
		setMetaAttribute(
			'meta[name="twitter:image"]',
			"name",
			"twitter:image",
			imageUrl,
		);
		setMetaAttribute(
			'meta[property="og:locale"]',
			"property",
			"og:locale",
			locale,
		);
		setMetaAttribute(
			'meta[name="robots"]',
			"name",
			"robots",
			noindex ? "noindex, nofollow" : "index, follow",
		);

		setCanonical(canonicalUrl);
	}, [description, image, locale, noindex, path, title]);
}
