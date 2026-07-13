import { NavLink, Outlet } from "react-router-dom";
import { routes } from "../config/routes";
import { siteConfig } from "../config/siteConfig";

function SiteLayout({ lang, setLang, copy }) {
	const year = new Date().getFullYear();

	return (
		<div className='site-shell'>
			<header className='site-header'>
				<div className='brand-wrap'>
					<p className='eyebrow'>{copy.location}</p>
					<NavLink className='brand' to={routes.home}>
						<span className='brand-dot' aria-hidden='true' />
						{copy.brand}
					</NavLink>
				</div>

				<div className='header-actions'>
					<nav aria-label='Principal'>
						<ul className='menu'>
							<li>
								<NavLink to={routes.home} end>
									{copy.nav.home}
								</NavLink>
							</li>
							<li>
								<NavLink to={routes.services}>{copy.nav.services}</NavLink>
							</li>
							<li>
								<NavLink to={routes.contact}>{copy.nav.contact}</NavLink>
							</li>
						</ul>
					</nav>

					<button
						type='button'
						className='lang-toggle'
						onClick={() => setLang(lang === "es" ? "en" : "es")}
						aria-label='Cambiar idioma / Change language'
					>
						{lang === "es" ? "EN" : "ES"}
					</button>
				</div>
			</header>

			<main>
				<Outlet />
			</main>

			<footer className='site-footer'>
				<div className='footer-grid'>
					<div className='footer-brand'>
						<h4>{copy.brand}</h4>
						<p>{copy.footer.tagline}</p>
					</div>

					<div className='footer-col'>
						<h5>{copy.footer.navTitle}</h5>
						<ul>
							<li>
								<NavLink to={routes.home}>{copy.nav.home}</NavLink>
							</li>
							<li>
								<NavLink to={routes.services}>{copy.nav.services}</NavLink>
							</li>
							<li>
								<NavLink to={routes.contact}>{copy.nav.contact}</NavLink>
							</li>
						</ul>
					</div>

					<div className='footer-col'>
						<h5>{copy.footer.contactTitle}</h5>
						<ul>
							<li>
								<a href={`mailto:${siteConfig.contactEmail}`}>
									{siteConfig.contactEmail}
								</a>
							</li>
							<li>
								<a href='tel:+573187519090'>+57 318 751 9090</a>
							</li>
							<li>{copy.location}</li>
						</ul>
					</div>
				</div>

				<div className='footer-bottom'>
					<span>
						© {year} {copy.brand}. {copy.footer.rights}
					</span>
					<div className='footer-social' aria-label='Redes sociales'>
						<a
							href={`mailto:${siteConfig.contactEmail}`}
							aria-label='Email'
							title='Email'
						>
							@
						</a>
						<a href='tel:+573187519090' aria-label='Telefono' title='Telefono'>
							T
						</a>
						<a
							href={`https://wa.me/573187519090`}
							aria-label='WhatsApp'
							title='WhatsApp'
							target='_blank'
							rel='noreferrer'
						>
							W
						</a>
					</div>
				</div>
			</footer>
		</div>
	);
}

export default SiteLayout;
