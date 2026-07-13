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
		<section className='section reveal-up'>
			<SeoHead
				meta={{
					title: copy.seo.contact.title,
					description: copy.seo.contact.description,
					path: routes.contact,
					locale: lang === "es" ? "es_CO" : "en_US",
				}}
			/>

			<h1>{copy.contact.title}</h1>
			<p className='page-subtitle'>{copy.contact.subtitle}</p>

			<div className='contact-layout'>
				<section className='contact-card'>
					<figure className='contact-media'>
						<img
							src='/images/ITPro-IT-Solution-Divi-Child-Theme-Image-19.jpg'
							alt='Equipo de BizShore colaborando en oficina'
							loading='lazy'
						/>
					</figure>

					<h3>BizShore Solutions SAS</h3>
					<ul className='contact-list'>
						{copy.contact.details.map((detail) => (
							<li key={detail.label}>
								<span>{detail.label}</span>
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
				</section>

				<form className='contact-form' onSubmit={handleSubmit}>
					<label htmlFor='name'>{copy.contact.form.name}</label>
					<input
						id='name'
						name='name'
						type='text'
						placeholder={copy.contact.form.name}
						required
					/>

					<label htmlFor='email'>{copy.contact.form.email}</label>
					<input
						id='email'
						name='email'
						type='email'
						placeholder={copy.contact.form.email}
						required
					/>

					<label htmlFor='message'>{copy.contact.form.message}</label>
					<textarea
						id='message'
						name='message'
						rows='5'
						placeholder={copy.contact.form.message}
						required
					/>

					<input
						className='hidden-field'
						type='text'
						name='website'
						tabIndex='-1'
						autoComplete='off'
						aria-hidden='true'
					/>

					<button
						type='submit'
						className='btn btn-primary'
						disabled={status === "submitting"}
					>
						{copy.contact.form.submit}
					</button>

					{status === "success" && (
						<p className='form-state form-success'>
							{copy.contact.form.success}
						</p>
					)}
					{status === "missing-endpoint" && (
						<p className='form-state form-warning'>
							{copy.contact.form.endpointMissing}
						</p>
					)}
					{status === "request-failed" && (
						<p className='form-state form-error'>{copy.contact.form.error}</p>
					)}

					{(status === "missing-endpoint" || status === "request-failed") && (
						<a
							className='btn btn-ghost'
							href={`mailto:${siteConfig.contactEmail}`}
						>
							{copy.contact.form.directEmail}
						</a>
					)}

					<p className='form-note'>{copy.contact.form.note}</p>
				</form>
			</div>
		</section>
	);
}

export default ContactPage;
