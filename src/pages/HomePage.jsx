import { Link } from "react-router-dom";
import { routes } from "../config/routes";
import { siteConfig } from "../config/siteConfig";
import SeoHead from "../seo/SeoHead";

function HomePage({ copy, lang }) {
	return (
		<>
			<SeoHead
				meta={{
					title: copy.seo.home.title,
					description: copy.seo.home.description,
					path: routes.home,
					locale: lang === "es" ? "es_CO" : "en_US",
				}}
			/>

			<section className='hero-section reveal-up'>
				<div className='hero-grid'>
					<div className='hero-copy'>
						<p className='badge hero-eyebrow'>{copy.hero.badge}</p>
						<h1 className='hero-title'>{copy.hero.title}</h1>
						<p className='hero-subtitle'>{copy.hero.subtitle}</p>

						<div className='hero-actions'>
							<a
								className='btn btn-primary'
								href={`mailto:${siteConfig.contactEmail}`}
							>
								{copy.cta.primary}
							</a>
							<Link className='btn btn-ghost' to={routes.services}>
								{copy.cta.secondary}
							</Link>
						</div>

						<div className='stats-grid' aria-label='Indicadores principales'>
							{copy.hero.stats.map((stat) => (
								<article key={stat.label} className='stat-card'>
									<p className='stat-value'>{stat.value}</p>
									<p className='stat-label'>{stat.label}</p>
								</article>
							))}
						</div>
					</div>

					<figure className='hero-media'>
						<img
							src='/images/ITPro-IT-Solution-Divi-Child-Theme-Image-46.jpg'
							alt='Consultor de BizShore en entorno corporativo'
							fetchPriority='high'
						/>
					</figure>
				</div>
			</section>

			<section className='section reveal-up delay-1'>
				<header className='section-heading'>
					<span className='section-eyebrow'>{copy.home.sectionEyebrow}</span>
					<h2>{copy.home.sectionTitle}</h2>
					<p className='page-subtitle'>{copy.home.sectionIntro}</p>
				</header>
				<figure className='home-wide-media'>
					<img
						src='/images/ITPro-IT-Solution-Divi-Child-Theme-Image-22.jpg'
						alt='Equipo revisando metricas de software y analitica'
						loading='lazy'
					/>
				</figure>
				<div className='feature-grid'>
					{copy.home.cards.map((card, index) => (
						<article key={card.title} className='feature-card'>
							<h3>
								<span className='feature-icon' aria-hidden='true'>
									{String(index + 1).padStart(2, "0")}
								</span>
								{card.title}
							</h3>
							<p>{card.description}</p>
						</article>
					))}
				</div>
			</section>
		</>
	);
}

export default HomePage;
