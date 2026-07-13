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

			<div className='services-visual-grid'>
				<figure className='services-media services-media-large'>
					<img
						src='/images/ITPro-IT-Solution-Divi-Child-Theme-Image-20.jpg'
						alt='Reunion tecnica del equipo de desarrollo'
						loading='lazy'
					/>
				</figure>
				<figure className='services-media'>
					<img
						src='/images/ITPro-IT-Solution-Divi-Child-Theme-Image-14.jpg'
						alt='Consultores colaborando en decisiones de software'
						loading='lazy'
					/>
				</figure>
				<figure className='services-media'>
					<img
						src='/images/ITPro-IT-Solution-Divi-Child-Theme-Image-43.jpg'
						alt='Infraestructura de estaciones de trabajo tecnicas'
						loading='lazy'
					/>
				</figure>
			</div>

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
