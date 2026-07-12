import { siteConfig } from "../config/siteConfig";

export async function submitContactForm(payload) {
	if (!siteConfig.formspreeEndpoint) {
		return {
			ok: false,
			reason: "missing-endpoint",
		};
	}

	const response = await fetch(siteConfig.formspreeEndpoint, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		return {
			ok: false,
			reason: "request-failed",
		};
	}

	return {
		ok: true,
	};
}
