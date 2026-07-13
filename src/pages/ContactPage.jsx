import { useState } from "react";
import { routes } from "../config/routes";
import { siteConfig } from "../config/siteConfig";
import SeoHead from "../seo/SeoHead";
import { submitContactForm } from "../services/contactService";

function ContactPage({ copy, lang }) {
	const [status, setStatus] = useState("idle");

	const handleSubmit = async (event) => {
		event.preventDefault();

		if (!siteConfig.formspreeEndpoint) {
			setStatus("missing-endpoint");
			return;
		}

		const formData = new FormData(event.currentTarget);
		const honeypot = String(formData.get("website") || "");

		if (honeypot.trim().length > 0) {
			setStatus("success");
			event.currentTarget.reset();
			return;
		}

		const payload = {
			name: formData.get("name"),
			email: formData.get("email"),
			message: formData.get("message"),
			source: "bizshore-home-contact-page",
		};

		setStatus("submitting");
		const result = await submitContactForm(payload);

		if (result.ok) {
			setStatus("success");
			event.currentTarget.reset();
			return;
		}

		setStatus(result.reason);
	};

	return (
		<>
			<SeoHead
				meta={{
					title: copy.seo.contact.title,
					description: copy.seo.contact.description,
					path: routes.contact,
					locale: lang === "es" ? "es_CO" : "en_US",
				}}
			/>

			<section className='page-hero reveal-up'>
				<div className='page-hero-copy'>
					<span className='page-hero-eyebrow'>{copy.contact.eyebrow}</span>
					<h1>{copy.contact.title}</h1>
					<p className='page-subtitle'>{copy.contact.subtitle}</p>
				</div>
			</section>

			<section className='section reveal-up delay-1'>
				<div className='contact-layout'>
					<aside className='contact-card'>
						<figure className='contact-media'>
							<img
								src='/images/ITPro-IT-Solution-Divi-Child-Theme-Image-19.jpg'
								alt='Equipo de BizShore colaborando en oficina'
								loading='lazy'
							/>
						</figure>

						<header className='contact-card-head'>
							<span className='contact-card-eyebrow'>
								{copy.contact.cardEyebrow}
							</span>
							<h3>BizShore Solutions SAS</h3>
						</header>

						<ul className='contact-list'>
							{copy.contact.details.map((detail) => (
								<li key={detail.label}>
									<span className='contact-list-label'>{detail.label}</span>
									{detail.href ? (
										<a
											href={detail.href}
											target={
												detail.href.startsWith("http") ? "_blank" : undefined
											}
											rel={
												detail.href.startsWith("http") ? "noreferrer" : undefined
											}
										>
											{detail.value}
										</a>
									) : (
										<strong>{detail.value}</strong>
									)}
								</li>
							))}
						</ul>
					</aside>

					<form className='contact-form' onSubmit={handleSubmit} noValidate>
						<header className='contact-form-head'>
							<span className='contact-form-eyebrow'>
								{copy.contact.form.eyebrow}
							</span>
							<h3>{copy.contact.form.title}</h3>
							<p className='contact-form-intro'>{copy.contact.form.intro}</p>
						</header>

						<div className='form-row'>
							<div className='form-field'>
								<label htmlFor='name'>{copy.contact.form.name}</label>
								<input
									id='name'
									name='name'
									type='text'
									placeholder={copy.contact.form.namePlaceholder}
									required
								/>
							</div>
							<div className='form-field'>
								<label htmlFor='email'>{copy.contact.form.email}</label>
								<input
									id='email'
									name='email'
									type='email'
									placeholder={copy.contact.form.emailPlaceholder}
									required
								/>
							</div>
						</div>

						<div className='form-field'>
							<label htmlFor='message'>{copy.contact.form.message}</label>
							<textarea
								id='message'
								name='message'
								rows='5'
								placeholder={copy.contact.form.messagePlaceholder}
								required
							/>
						</div>

						<input
							className='hidden-field'
							type='text'
							name='website'
							tabIndex='-1'
							autoComplete='off'
							aria-hidden='true'
						/>

						<div className='form-actions'>
							<button
								type='submit'
								className='btn btn-primary'
								disabled={status === "submitting"}
							>
								{status === "submitting"
									? copy.contact.form.submitting
									: copy.contact.form.submit}
							</button>
							<p className='form-note'>{copy.contact.form.note}</p>
						</div>

						{status === "success" && (
							<p className='form-state form-success' role='status'>
								{copy.contact.form.success}
							</p>
						)}
						{status === "missing-endpoint" && (
							<p className='form-state form-warning' role='status'>
								{copy.contact.form.endpointMissing}
							</p>
						)}
						{status === "request-failed" && (
							<p className='form-state form-error' role='status'>
								{copy.contact.form.error}
							</p>
						)}

						{(status === "missing-endpoint" || status === "request-failed") && (
							<a
								className='btn btn-ghost'
								href={`mailto:${siteConfig.contactEmail}`}
							>
								{copy.contact.form.directEmail}
							</a>
						)}
					</form>
				</div>
			</section>
		</>
	);
}

export default ContactPage;
