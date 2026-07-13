import { routes } from "../config/routes";
import SeoHead from "../seo/SeoHead";

function ServicesPage({ copy, lang }) {
	return (
		<>
			<SeoHead
				meta={{
					title: copy.seo.services.title,
					description: copy.seo.services.description,
					path: routes.services,
					locale: lang === "es" ? "es_CO" : "en_US",
				}}
			/>

			<section className='page-hero reveal-up'>
				<div className='page-hero-copy'>
					<span className='page-hero-eyebrow'>{copy.services.eyebrow}</span>
					<h1>{copy.services.title}</h1>
					<p className='page-subtitle'>{copy.services.subtitle}</p>
				</div>
			</section>

			<section className='section reveal-up delay-1'>
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
			</section>

			<section className='section reveal-up delay-2'>
				<header className='section-heading'>
					<span className='section-eyebrow'>{copy.services.listEyebrow}</span>
					<h2>{copy.services.listTitle}</h2>
					<p className='page-subtitle'>{copy.services.listIntro}</p>
				</header>

				<div className='services-grid'>
					{copy.services.list.map((service, index) => (
						<article key={service.name} className='service-card'>
							<header className='service-card-head'>
								<span className='service-card-num' aria-hidden='true'>
									{String(index + 1).padStart(2, "0")}
								</span>
								<h3>{service.name}</h3>
							</header>
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
		</>
	);
}

export default ServicesPage;
