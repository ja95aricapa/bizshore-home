import { Link } from "react-router-dom";
import { routes } from "../config/routes";
import SeoHead from "../seo/SeoHead";

function NotFoundPage({ copy, lang }) {
	return (
		<section className='section reveal-up'>
			<SeoHead
				meta={{
					title: copy.seo.notFound.title,
					description: copy.seo.notFound.description,
					path: "/404",
					locale: lang === "es" ? "es_CO" : "en_US",
					noindex: true,
				}}
			/>

			<h1>404</h1>
			<p className='page-subtitle'>La pagina que buscas no existe.</p>
			<Link className='btn btn-ghost' to={routes.home}>
				Volver al inicio
			</Link>
		</section>
	);
}

export default NotFoundPage;
