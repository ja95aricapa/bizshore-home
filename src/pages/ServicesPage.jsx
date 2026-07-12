import { routes } from "../config/routes";
import SeoHead from "../seo/SeoHead";

function ServicesPage({ copy, lang }) {
	return (
		<section className='section reveal-up'>
			<SeoHead
				meta={{
					title: copy.seo.services.title,
					description: copy.seo.services.description,
					path: routes.services,
					locale: lang === "es" ? "es_CO" : "en_US",
				}}
			/>

			<h1>{copy.services.title}</h1>
			<p className='page-subtitle'>{copy.services.subtitle}</p>

			<div className='services-grid'>
				{copy.services.list.map((service) => (
					<article key={service.name} className='service-card'>
						<h3>{service.name}</h3>
						<p>{service.summary}</p>
						<ul>
							{service.bullets.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					</article>
				))}
			</div>
		</section>
	);
}

export default ServicesPage;
