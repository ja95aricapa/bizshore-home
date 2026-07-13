import { Link } from "react-router-dom";
import { routes } from "../config/routes";
import SeoHead from "../seo/SeoHead";

function NotFoundPage({ copy, lang }) {
	return (
		<div className='notfound-shell reveal-up'>
			<SeoHead
				meta={{
					title: copy.seo.notFound.title,
					description: copy.seo.notFound.description,
					path: "/404",
					locale: lang === "es" ? "es_CO" : "en_US",
					noindex: true,
				}}
			/>

			<section className='notfound-card'>
				<figure className='notfound-media'>
					<img
						src='/images/ITPro-IT-Solution-Divi-Child-Theme-Image-15.jpg'
						alt='Ilustracion de pieza perdida en el sistema'
						loading='lazy'
					/>
					<div className='notfound-media-overlay' aria-hidden='true' />
				</figure>

				<div className='notfound-body'>
					<span className='badge notfound-eyebrow'>
						{copy.notFound.eyebrow}
					</span>
					<p className='notfound-code' aria-hidden='true'>
						404
					</p>
					<h1>{copy.notFound.title}</h1>
					<p className='page-subtitle'>{copy.notFound.subtitle}</p>

					<div className='notfound-actions'>
						<Link className='btn btn-primary' to={routes.home}>
							{copy.notFound.primary}
						</Link>
						<Link className='btn btn-ghost' to={routes.services}>
							{copy.notFound.secondary}
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
}

export default NotFoundPage;
