import { routes } from "../config/routes";
import { siteConfig } from "../config/siteConfig";
import SeoHead from "../seo/SeoHead";

function LandingPage({ copy, lang }) {
	return (
		<div className='landing-shell reveal-up'>
			<SeoHead
				meta={{
					title: copy.seo.landing.title,
					description: copy.seo.landing.description,
					path: routes.landing,
					locale: lang === "es" ? "es_CO" : "en_US",
				}}
			/>

			<section className='landing-card'>
				<p className='badge'>Landing exclusiva</p>
				<h1>{copy.landing.title}</h1>
				<p className='page-subtitle'>{copy.landing.subtitle}</p>

				<ul className='landing-list'>
					{copy.landing.bullets.map((point) => (
						<li key={point}>{point}</li>
					))}
				</ul>

				<a
					className='btn btn-primary'
					href={`mailto:${siteConfig.contactEmail}?subject=Diagnostico%20BizShore`}
				>
					{copy.landing.cta}
				</a>

				<p className='landing-note'>{copy.landing.disclaimer}</p>
			</section>
		</div>
	);
}

export default LandingPage;
