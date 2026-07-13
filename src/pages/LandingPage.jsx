import { routes } from "../config/routes";
import { siteConfig } from "../config/siteConfig";
import SeoHead from "../seo/SeoHead";

function LandingPage({ copy, lang }) {
	return (
		<>
			<SeoHead
				meta={{
					title: copy.seo.landing.title,
					description: copy.seo.landing.description,
					path: routes.landing,
					locale: lang === "es" ? "es_CO" : "en_US",
				}}
			/>

			<div className='landing-shell reveal-up'>
				<section className='landing-card'>
					<figure className='landing-media'>
						<img
							src='/images/ITPro-IT-Solution-Divi-Child-Theme-Image-27.jpg'
							alt='Consultoria personalizada para transformacion digital'
							loading='lazy'
						/>
					</figure>

					<div className='landing-card-body'>
						<p className='badge landing-badge'>{copy.landing.eyebrow}</p>
						<h1>{copy.landing.title}</h1>
						<p className='page-subtitle'>{copy.landing.subtitle}</p>

						<ul className='landing-list'>
							{copy.landing.bullets.map((point) => (
								<li key={point}>{point}</li>
							))}
						</ul>

						<div className='landing-actions'>
							<a
								className='btn btn-primary'
								href={`mailto:${siteConfig.contactEmail}?subject=Diagnostico%20BizShore`}
							>
								{copy.landing.cta}
							</a>
						</div>

						<p className='landing-note'>{copy.landing.disclaimer}</p>
					</div>
				</section>
			</div>

			<section className='section reveal-up delay-1'>
				<header className='section-heading'>
					<span className='section-eyebrow'>{copy.landing.processEyebrow}</span>
					<h2>{copy.landing.processTitle}</h2>
					<p className='page-subtitle'>{copy.landing.processIntro}</p>
				</header>

				<div className='process-grid'>
					{copy.landing.processSteps.map((step, index) => (
						<article key={step.title} className='process-step'>
							<span className='process-step-num' aria-hidden='true'>
								{String(index + 1).padStart(2, "0")}
							</span>
							<h3>{step.title}</h3>
							<p>{step.description}</p>
						</article>
					))}
				</div>
			</section>
		</>
	);
}

export default LandingPage;
